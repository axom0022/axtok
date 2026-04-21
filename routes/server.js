const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const githubdb = require('./githubdb');
const auth = require('./auth');
const videoroutes = require('./routes/videos');
const userroutes = require('./routes/users');
const socialroutes = require('./routes/social');

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'too many attempts, try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'too many actions, slow down' },
});
app.use('/api/social/', actionLimiter);
app.use('/api/videos/', actionLimiter);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use((req, res, next) => {
  res.setHeader('x-powered-by', 'axtok');
  next();
});

app.use('/api/auth', auth);
app.use('/api/videos', videoroutes);
app.use('/api/users', userroutes);
app.use('/api/social', socialroutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(port, () => {
  console.log(`axtok running on port ${port}`);
  githubdb.ensureprivaterepo();
});
