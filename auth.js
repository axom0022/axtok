const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const xss = require('xss');
const githubdb = require('./githubdb');

const router = express.Router();
const jwtsecret = 'axtoksecret2024';

router.post('/register', [
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-z0-9_]+$/i),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid input' });
  }
  let { username, email, password } = req.body;
  username = xss(username.trim());
  email = xss(email.trim());
  try {
    const users = await githubdb.readdata('users');
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'username taken' });
    }
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'email registered' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const userid = await githubdb.getnextid('userid');
    const avatar = `https://picsum.photos/id/${Math.floor(Math.random() * 100)}/200/200`;
    const newuser = {
      id: userid, username, email, password: hashed, avatar,
      bio: '', followerscount: 0, followingcount: 0, createdat: new Date().toISOString()
    };
    users.push(newuser);
    await githubdb.writedata('users', users);
    const token = jwt.sign({ userid: newuser.id }, jwtsecret, { expiresIn: '7d' });
    res.json({ token, user: { id: newuser.id, username, email, avatar, bio: '' } });
  } catch (error) {
    res.status(500).json({ error: 'registration failed' });
  }
});

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid input' });
  }
  const { email, password } = req.body;
  try {
    const users = await githubdb.readdata('users');
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const token = jwt.sign({ userid: user.id }, jwtsecret, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio } });
  } catch (error) {
    res.status(500).json({ error: 'login failed' });
  }
});

function authenticate(req, res, next) {
  const authheader = req.headers.authorization;
  const token = authheader && authheader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'no token' });
  jwt.verify(token, jwtsecret, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'invalid token' });
    req.userid = decoded.userid;
    next();
  });
}

module.exports = { router, authenticate };
