const { Octokit } = require('@octokit/rest');

const githubtoken = 'urgithubtoken';
const owner = 'urgithubusername';
const repo = 'axtokdata';

const octokit = new Octokit({ auth: githubtoken });

let requestwindow = 0;
let lastreset = Date.now();

async function checklimit() {
  const now = Date.now();
  if (now - lastreset > 3600000) {
    requestwindow = 0;
    lastreset = now;
  }
  if (requestwindow >= 4500) {
    throw new Error('github api limit reached');
  }
  try {
    const { data: rate } = await octokit.rateLimit.get();
    if (rate.resources.core.remaining < 200) {
      throw new Error('github rate limit low');
    }
    requestwindow++;
  } catch (e) {}
}

const datafiles = {
  users: 'data/users.json',
  videos: 'data/videos.json',
  likes: 'data/likes.json',
  comments: 'data/comments.json',
  follows: 'data/follows.json',
  reposts: 'data/reposts.json',
  notifications: 'data/notifications.json',
  counters: 'data/counters.json'
};

async function ensureprivaterepo() {
  try {
    const { data: repodata } = await octokit.repos.get({ owner, repo });
    if (!repodata.private) {
      await octokit.repos.update({ owner, repo, private: true });
    }
    return true;
  } catch (error) {
    if (error.status === 404) {
      await octokit.repos.createForAuthenticatedUser({
        name: repo,
        description: 'axtok private data',
        private: true,
        auto_init: true
      });
      for (const [key, filepath] of Object.entries(datafiles)) {
        await octokit.repos.createOrUpdateFileContents({
          owner, repo,
          path: filepath,
          message: `init ${filepath}`,
          content: Buffer.from(JSON.stringify([], null, 2)).toString('base64')
        });
      }
      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: 'data/counters.json',
        message: 'init counters',
        content: Buffer.from(JSON.stringify({ userid: 1, videoid: 1, commentid: 1, likeid: 1 }, null, 2)).toString('base64')
      });
    }
    return true;
  }
}

async function readdata(filekey) {
  await checklimit();
  const filepath = datafiles[filekey];
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filepath });
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
}

async function writedata(filekey, data, sha = null) {
  await checklimit();
  const filepath = datafiles[filekey];
  let currentsha = sha;
  if (!currentsha) {
    try {
      const { data: filedata } = await octokit.repos.getContent({ owner, repo, path: filepath });
      currentsha = filedata.sha;
    } catch (e) { currentsha = null; }
  }
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: filepath,
    message: `update ${filepath}`,
    content,
    sha: currentsha
  });
}

async function getnextid(name) {
  const counters = await readdata('counters');
  const current = counters[name] || 1;
  counters[name] = current + 1;
  await writedata('counters', counters);
  return current;
}

async function getstatus() {
  try {
    await octokit.users.getAuthenticated();
    const { data: repodata } = await octokit.repos.get({ owner, repo }).catch(() => ({ data: null }));
    return { connected: true, repoexists: !!repodata, isprivate: repodata ? repodata.private : false };
  } catch {
    return { connected: false, repoexists: false, isprivate: false };
  }
}

module.exports = { ensureprivaterepo, readdata, writedata, getnextid, getstatus, datafiles };
