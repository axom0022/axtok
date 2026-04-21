const express = require('express');
const { param, validationResult } = require('express-validator');
const xss = require('xss');
const githubdb = require('../githubdb');
const auth = require('../auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const videos = await githubdb.readdata('videos');
    const users = await githubdb.readdata('users');
    const enriched = videos.slice(-50).map(v => {
      const user = users.find(u => u.id === v.userid);
      return {
        id: v.id, userid: v.userid, videourl: v.videourl,
        caption: xss(v.caption || ''), sound: xss(v.sound || ''),
        likescount: v.likescount, commentscount: v.commentscount,
        sharescount: v.sharescount, repostscount: v.repostscount,
        username: user ? user.username : 'unknown',
        avatar: user ? user.avatar : '', createdat: v.createdat
      };
    }).reverse();
    res.json(enriched);
  } catch {
    res.status(500).json({ error: 'failed to fetch' });
  }
});

router.get('/:id', [
  param('id').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    const videos = await githubdb.readdata('videos');
    const users = await githubdb.readdata('users');
    const video = videos.find(v => v.id == req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'not found' });
    }
    const user = users.find(u => u.id === video.userid);
    res.json({ ...video, caption: xss(video.caption), sound: xss(video.sound), username: user.username, avatar: user.avatar });
  } catch {
    res.status(500).json({ error: 'failed to fetch' });
  }
});

router.post('/', auth.authenticate, async (req, res) => {
  let { videourl, caption, sound } = req.body;
  if (!videourl) {
    return res.status(400).json({ error: 'videourl required' });
  }
  videourl = xss(videourl.trim());
  caption = xss((caption || '').trim().substring(0, 200));
  sound = xss((sound || 'original sound').trim());
  try {
    const videoid = await githubdb.getnextid('videoid');
    const newvideo = {
      id: videoid, userid: req.userid, videourl: videourl, caption: caption, sound: sound,
      likescount: 0, commentscount: 0, sharescount: 0, repostscount: 0,
      createdat: new Date().toISOString()
    };
    const videos = await githubdb.readdata('videos');
    videos.push(newvideo);
    await githubdb.writedata('videos', videos);
    res.json({ id: videoid, message: 'created' });
  } catch {
    res.status(500).json({ error: 'creation failed' });
  }
});

router.delete('/:id', auth.authenticate, async (req, res) => {
  try {
    let videos = await githubdb.readdata('videos');
    const idx = videos.findIndex(v => v.id == req.params.id && v.userid === req.userid);
    if (idx === -1) {
      return res.status(404).json({ error: 'not found' });
    }
    videos.splice(idx, 1);
    await githubdb.writedata('videos', videos);
    res.json({ message: 'deleted' });
  } catch {
    res.status(500).json({ error: 'deletion failed' });
  }
});

module.exports = router;
