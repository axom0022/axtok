const express = require('express');
const { param, query, validationResult } = require('express-validator');
const xss = require('xss');
const githubdb = require('../githubdb');
const auth = require('../auth');

const router = express.Router();

router.get('/:id', [
  param('id').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    const users = await githubdb.readdata('users');
    const user = users.find(u => u.id == req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }
    res.json({
      id: user.id, username: user.username, avatar: user.avatar,
      bio: user.bio, followerscount: user.followerscount, followingcount: user.followingcount
    });
  } catch {
    res.status(500).json({ error: 'failed to fetch' });
  }
});

router.get('/:id/videos', [
  param('id').isInt({ min: 1 })
], async (req, res) => {
  try {
    const videos = await githubdb.readdata('videos');
    const uservideos = videos.filter(v => v.userid == req.params.id).reverse();
    res.json(uservideos);
  } catch {
    res.status(500).json({ error: 'failed to fetch' });
  }
});

router.put('/profile', auth.authenticate, async (req, res) => {
  let { bio, avatar } = req.body;
  bio = xss((bio || '').trim().substring(0, 200));
  avatar = avatar ? xss(avatar.trim()) : null;
  try {
    let users = await githubdb.readdata('users');
    const idx = users.findIndex(u => u.id === req.userid);
    if (idx === -1) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (bio !== undefined) users[idx].bio = bio;
    if (avatar) users[idx].avatar = avatar;
    await githubdb.writedata('users', users);
    res.json({ message: 'profile updated' });
  } catch {
    res.status(500).json({ error: 'update failed' });
  }
});

router.get('/search/all', [
  query('q').notEmpty().isLength({ min: 1, max: 50 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid search' });
  }
  const q = req.query.q.toLowerCase();
  try {
    const users = await githubdb.readdata('users');
    const matched = users.filter(u => u.username.toLowerCase().includes(q));
    res.json(matched.map(u => ({
      id: u.id, username: u.username, avatar: u.avatar, bio: u.bio
    })));
  } catch {
    res.status(500).json({ error: 'search failed' });
  }
});

module.exports = router;
