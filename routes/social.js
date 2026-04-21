const express = require('express');
const { param, body, validationResult } = require('express-validator');
const xss = require('xss');
const githubdb = require('../githubdb');
const auth = require('../auth');

const router = express.Router();

router.post('/like/:videoid', [
  param('videoid').isInt({ min: 1 })
], auth.authenticate, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const videoid = parseInt(req.params.videoid);
  try {
    let likes = await githubdb.readdata('likes');
    let videos = await githubdb.readdata('videos');
    if (likes.find(l => l.userid === req.userid && l.videoid === videoid)) {
      return res.status(400).json({ error: 'already liked' });
    }
    const likeid = await githubdb.getnextid('likeid');
    likes.push({ id: likeid, userid: req.userid, videoid: videoid, createdat: new Date().toISOString() });
    const vindex = videos.findIndex(v => v.id === videoid);
    if (vindex !== -1) videos[vindex].likescount += 1;
    await githubdb.writedata('likes', likes);
    await githubdb.writedata('videos', videos);
    res.json({ liked: true });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.delete('/like/:videoid', [
  param('videoid').isInt({ min: 1 })
], auth.authenticate, async (req, res) => {
  const videoid = parseInt(req.params.videoid);
  try {
    let likes = await githubdb.readdata('likes');
    let videos = await githubdb.readdata('videos');
    const idx = likes.findIndex(l => l.userid === req.userid && l.videoid === videoid);
    if (idx === -1) {
      return res.status(404).json({ error: 'like not found' });
    }
    likes.splice(idx, 1);
    const vindex = videos.findIndex(v => v.id === videoid);
    if (vindex !== -1 && videos[vindex].likescount > 0) videos[vindex].likescount -= 1;
    await githubdb.writedata('likes', likes);
    await githubdb.writedata('videos', videos);
    res.json({ liked: false });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/comment/:videoid', [
  param('videoid').isInt({ min: 1 }),
  body('content').isLength({ min: 1, max: 500 })
], auth.authenticate, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'invalid input' });
  }
  const videoid = parseInt(req.params.videoid);
  let content = xss(req.body.content.trim());
  try {
    let comments = await githubdb.readdata('comments');
    let videos = await githubdb.readdata('videos');
    const users = await githubdb.readdata('users');
    const commentid = await githubdb.getnextid('commentid');
    const newcomment = {
      id: commentid, userid: req.userid, videoid: videoid,
      content: content, createdat: new Date().toISOString()
    };
    comments.push(newcomment);
    const vindex = videos.findIndex(v => v.id === videoid);
    if (vindex !== -1) videos[vindex].commentscount += 1;
    await githubdb.writedata('comments', comments);
    await githubdb.writedata('videos', videos);
    const user = users.find(u => u.id === req.userid);
    res.json({ ...newcomment, username: user.username, avatar: user.avatar });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.get('/comments/:videoid', [
  param('videoid').isInt({ min: 1 })
], async (req, res) => {
  try {
    const comments = await githubdb.readdata('comments');
    const users = await githubdb.readdata('users');
    const videocomments = comments.filter(c => c.videoid == req.params.videoid);
    const enriched = videocomments.map(c => {
      const user = users.find(u => u.id === c.userid);
      return { ...c, content: xss(c.content), username: user ? user.username : 'unknown', avatar: user ? user.avatar : '' };
    }).reverse();
    res.json(enriched);
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/follow/:userid', [
  param('userid').isInt({ min: 1 })
], auth.authenticate, async (req, res) => {
  const targetid = parseInt(req.params.userid);
  if (targetid === req.userid) {
    return res.status(400).json({ error: 'cannot follow self' });
  }
  try {
    let follows = await githubdb.readdata('follows');
    let users = await githubdb.readdata('users');
    if (follows.find(f => f.followerid === req.userid && f.followingid === targetid)) {
      return res.status(400).json({ error: 'already following' });
    }
    follows.push({
      id: await githubdb.getnextid('followid'),
      followerid: req.userid, followingid: targetid, createdat: new Date().toISOString()
    });
    const findex = users.findIndex(u => u.id === req.userid);
    const tindex = users.findIndex(u => u.id === targetid);
    if (findex !== -1) users[findex].followingcount += 1;
    if (tindex !== -1) users[tindex].followerscount += 1;
    await githubdb.writedata('follows', follows);
    await githubdb.writedata('users', users);
    res.json({ following: true });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.delete('/follow/:userid', [
  param('userid').isInt({ min: 1 })
], auth.authenticate, async (req, res) => {
  const targetid = parseInt(req.params.userid);
  try {
    let follows = await githubdb.readdata('follows');
    let users = await githubdb.readdata('users');
    const idx = follows.findIndex(f => f.followerid === req.userid && f.followingid === targetid);
    if (idx === -1) {
      return res.status(404).json({ error: 'not following' });
    }
    follows.splice(idx, 1);
    const findex = users.findIndex(u => u.id === req.userid);
    const tindex = users.findIndex(u => u.id === targetid);
    if (findex !== -1 && users[findex].followingcount > 0) users[findex].followingcount -= 1;
    if (tindex !== -1 && users[tindex].followerscount > 0) users[tindex].followerscount -= 1;
    await githubdb.writedata('follows', follows);
    await githubdb.writedata('users', users);
    res.json({ following: false });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/repost/:videoid', [
  param('videoid').isInt({ min: 1 })
], auth.authenticate, async (req, res) => {
  const videoid = parseInt(req.params.videoid);
  try {
    let reposts = await githubdb.readdata('reposts');
    let videos = await githubdb.readdata('videos');
    if (reposts.find(r => r.userid === req.userid && r.videoid === videoid)) {
      return res.status(400).json({ error: 'already reposted' });
    }
    reposts.push({
      id: await githubdb.getnextid('repostid'),
      userid: req.userid, videoid: videoid, createdat: new Date().toISOString()
    });
    const vindex = videos.findIndex(v => v.id === videoid);
    if (vindex !== -1) videos[vindex].repostscount += 1;
    await githubdb.writedata('reposts', reposts);
    await githubdb.writedata('videos', videos);
    res.json({ reposted: true });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

router.delete('/repost/:videoid', [
  param('videoid').isInt({ min: 1 })
], auth.authenticate, async (req, res) => {
  const videoid = parseInt(req.params.videoid);
  try {
    let reposts = await githubdb.readdata('reposts');
    let videos = await githubdb.readdata('videos');
    const idx = reposts.findIndex(r => r.userid === req.userid && r.videoid === videoid);
    if (idx === -1) {
      return res.status(404).json({ error: 'repost not found' });
    }
    reposts.splice(idx, 1);
    const vindex = videos.findIndex(v => v.id === videoid);
    if (vindex !== -1 && videos[vindex].repostscount > 0) videos[vindex].repostscount -= 1;
    await githubdb.writedata('reposts', reposts);
    await githubdb.writedata('videos', videos);
    res.json({ reposted: false });
  } catch {
    res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;
