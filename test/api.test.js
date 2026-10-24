const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The env must be set before the app loads: db.js and middleware/auth.js read it at require time.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mooncircle-'));
process.env.DB_FILE = path.join(dir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-the-test-suite-only-0123456789abcdef';
process.env.NODE_ENV = 'test';

const app = require('../server/index');
const db = require('../server/db');

let server;
let base;

async function call(method, route, { body, cookie } = {}) {
  const res = await fetch(`${base}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

// Registers and logs in; returns the cookie to send on later requests.
async function signup(username) {
  const email = `${username}@test.com`;
  const password = 'password123';
  const reg = await call('POST', '/auth/register', { body: { username, name: username.toUpperCase(), email, password } });
  assert.equal(reg.status, 201);
  const login = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(login.status, 200);
  return { cookie: login.cookie, id: login.data.id, username };
}

const makePost = async (user, content = 'hello') =>
  (await call('POST', '/posts', { body: { content }, cookie: user.cookie })).data;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('register: duplicate username and email return 409 naming the field', async () => {
  await signup('alice');
  const sameName = await call('POST', '/auth/register', {
    body: { username: 'ALICE', name: 'Other', email: 'other@test.com', password: 'password123' },
  });
  assert.equal(sameName.status, 409);
  assert.match(sameName.data.error, /username/i);

  const sameEmail = await call('POST', '/auth/register', {
    body: { username: 'alice2', name: 'Other', email: 'alice@test.com', password: 'password123' },
  });
  assert.equal(sameEmail.status, 409);
  assert.match(sameEmail.data.error, /email/i);
});

test('register: invalid input returns 400', async () => {
  const bad = (override) => call('POST', '/auth/register', {
    body: { username: 'valid_name', name: 'Valid', email: 'v@test.com', password: 'password123', ...override },
  });
  assert.equal((await bad({ username: 'a!' })).status, 400);
  assert.equal((await bad({ name: 'x' })).status, 400);
  assert.equal((await bad({ email: 'nope' })).status, 400);
  assert.equal((await bad({ password: 'short' })).status, 400);
});

test('login: wrong password returns 401 with the same message as a wrong email', async () => {
  const wrongPass = await call('POST', '/auth/login', { body: { email: 'alice@test.com', password: 'wrong-password' } });
  const wrongEmail = await call('POST', '/auth/login', { body: { email: 'nobody@test.com', password: 'password123' } });
  assert.equal(wrongPass.status, 401);
  assert.equal(wrongEmail.status, 401);
  assert.equal(wrongPass.data.error, wrongEmail.data.error);
});

test('write routes return 401 without a login', async () => {
  const post = await makePost(await signup('writer'));
  for (const [method, route] of [
    ['POST', '/posts'],
    ['DELETE', `/posts/${post.id}`],
    ['POST', `/posts/${post.id}/like`],
    ['DELETE', `/posts/${post.id}/like`],
    ['POST', `/posts/${post.id}/comments`],
    ['DELETE', '/comments/1'],
    ['POST', '/users/writer/follow'],
    ['PATCH', '/users/me'],
    ['POST', '/auth/logout'],
  ]) {
    const res = await call(method, route, { body: { content: 'x' } });
    assert.equal(res.status, 401, `${method} ${route}`);
  }
});

test('posts: length limits (empty and 281 characters return 400, 280 is fine)', async () => {
  const user = await signup('poster');
  const send = (content) => call('POST', '/posts', { body: { content }, cookie: user.cookie });
  assert.equal((await send('   ')).status, 400);
  assert.equal((await send('a'.repeat(281))).status, 400);
  assert.equal((await send('a'.repeat(280))).status, 201);
});

test('comments: 201 for 200 characters, 400 for 201 or empty', async () => {
  const user = await signup('commenter');
  const post = await makePost(user);
  const send = (content) => call('POST', `/posts/${post.id}/comments`, { body: { content }, cookie: user.cookie });
  assert.equal((await send('')).status, 400);
  assert.equal((await send('a'.repeat(201))).status, 400);
  assert.equal((await send('a'.repeat(200))).status, 201);
  assert.equal((await call('POST', '/posts/99999/comments', { body: { content: 'hi' }, cookie: user.cookie })).status, 404);
});

test("403 when deleting someone else's post, and the post still exists", async () => {
  const owner = await signup('owner1');
  const other = await signup('other1');
  const post = await makePost(owner);
  const res = await call('DELETE', `/posts/${post.id}`, { cookie: other.cookie });
  assert.equal(res.status, 403);
  assert.equal((await call('GET', `/posts/${post.id}`)).status, 200);
  assert.equal((await call('DELETE', `/posts/${post.id}`, { cookie: owner.cookie })).status, 200);
  assert.equal((await call('GET', `/posts/${post.id}`)).status, 404);
});

test("403 when deleting someone else's comment, and the comment still exists", async () => {
  const author = await signup('cauthor');
  const other = await signup('cother');
  const post = await makePost(author);
  const comment = (await call('POST', `/posts/${post.id}/comments`, { body: { content: 'mine' }, cookie: author.cookie })).data;

  // The post's owner is not the comment's author, so this is also 403.
  const poster = await signup('cpostowner');
  const ownerPost = await makePost(poster);
  const foreign = (await call('POST', `/posts/${ownerPost.id}/comments`, { body: { content: 'x' }, cookie: other.cookie })).data;
  assert.equal((await call('DELETE', `/comments/${foreign.id}`, { cookie: poster.cookie })).status, 403);

  assert.equal((await call('DELETE', `/comments/${comment.id}`, { cookie: other.cookie })).status, 403);
  const list = await call('GET', `/posts/${post.id}/comments`);
  assert.equal(list.data.length, 1);
  assert.equal((await call('DELETE', `/comments/${comment.id}`, { cookie: author.cookie })).status, 200);
  assert.equal((await call('DELETE', '/comments/99999', { cookie: author.cookie })).status, 404);
});

test('likes are idempotent', async () => {
  const user = await signup('liker');
  const post = await makePost(user);
  const like = () => call('POST', `/posts/${post.id}/like`, { cookie: user.cookie });
  const unlike = () => call('DELETE', `/posts/${post.id}/like`, { cookie: user.cookie });

  assert.equal((await like()).data.like_count, 1);
  assert.equal((await like()).data.like_count, 1);
  assert.equal((await unlike()).data.like_count, 0);
  assert.equal((await unlike()).data.like_count, 0);
  assert.equal((await call('POST', '/posts/99999/like', { cookie: user.cookie })).status, 404);
});

test('follows: idempotent, self-follow is 400, unknown user is 404', async () => {
  const a = await signup('follow_a');
  await signup('follow_b');
  const follow = () => call('POST', '/users/follow_b/follow', { cookie: a.cookie });
  const unfollow = () => call('DELETE', '/users/follow_b/follow', { cookie: a.cookie });

  assert.equal((await follow()).data.follower_count, 1);
  assert.equal((await follow()).data.follower_count, 1);
  assert.equal((await unfollow()).data.follower_count, 0);
  assert.equal((await unfollow()).data.follower_count, 0);
  assert.equal((await call('POST', '/users/follow_a/follow', { cookie: a.cookie })).status, 400);
  assert.equal((await call('POST', '/users/nobody_here/follow', { cookie: a.cookie })).status, 404);
});

test('Following feed shows only followed users and your own posts', async () => {
  const me = await signup('feedme');
  const followed = await signup('feedfollowed');
  const stranger = await signup('feedstranger');
  const mine = await makePost(me, 'my post');
  const theirs = await makePost(followed, 'followed post');
  const strangers = await makePost(stranger, 'stranger post');

  await call('POST', '/users/feedfollowed/follow', { cookie: me.cookie });
  const res = await call('GET', '/posts?feed=following', { cookie: me.cookie });
  const ids = res.data.posts.map((p) => p.id);

  assert.ok(ids.includes(mine.id));
  assert.ok(ids.includes(theirs.id));
  assert.ok(!ids.includes(strangers.id));
  assert.equal((await call('GET', '/posts?feed=following')).status, 401);
});

test('feed pagination: before and has_more', async () => {
  const user = await signup('pager');
  for (let i = 0; i < 3; i++) await makePost(user, `page ${i}`);
  const first = await call('GET', '/posts?limit=2&user=pager');
  assert.equal(first.data.posts.length, 2);
  assert.equal(first.data.has_more, true);
  const next = await call('GET', `/posts?limit=2&user=pager&before=${first.data.posts[1].id}`);
  assert.equal(next.data.posts.length, 1);
  assert.equal(next.data.has_more, false);
  assert.equal((await call('GET', '/posts?limit=999')).status, 400);
  assert.equal((await call('GET', '/posts?before=abc')).status, 400);
});

test('deleting a post removes its comments and likes (cascade)', async () => {
  const owner = await signup('casowner');
  const fan = await signup('casfan');
  const post = await makePost(owner);
  await call('POST', `/posts/${post.id}/like`, { cookie: fan.cookie });
  await call('POST', `/posts/${post.id}/comments`, { body: { content: 'bye' }, cookie: fan.cookie });
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE post_id = ?`).get(post.id).n;
  assert.equal(count('likes'), 1);
  assert.equal(count('comments'), 1);

  await call('DELETE', `/posts/${post.id}`, { cookie: owner.cookie });
  assert.equal(count('likes'), 0);
  assert.equal(count('comments'), 0);
});

test('profile: counts, edit, search, and no email or password_hash anywhere', async () => {
  const user = await signup('profiler');
  await makePost(user);

  const profile = await call('GET', '/users/profiler', { cookie: user.cookie });
  assert.equal(profile.data.post_count, 1);
  assert.equal(profile.data.is_me, true);
  assert.equal((await call('GET', '/users/nobody_here')).status, 404);

  const edit = await call('PATCH', '/users/me', { body: { bio: 'new bio' }, cookie: user.cookie });
  assert.equal(edit.data.bio, 'new bio');
  assert.equal((await call('PATCH', '/users/me', { body: { bio: 'x'.repeat(161) }, cookie: user.cookie })).status, 400);

  // _ and % must be matched literally, not as wildcards:
  // 'prof_ler' would match "profiler" if _ were a wildcard, and no user contains a real %
  assert.equal((await call('GET', '/users?q=prof_ler')).data.length, 0);
  assert.equal((await call('GET', `/users?q=${encodeURIComponent('%')}`)).data.length, 0);
  assert.equal((await call('GET', '/users?q=profil')).data.length, 1);
  assert.equal((await call('GET', '/users?q=')).status, 400);

  const responses = [
    JSON.stringify(profile.data),
    JSON.stringify((await call('GET', '/users?q=profil')).data),
    JSON.stringify((await call('GET', '/posts')).data),
    JSON.stringify((await call('GET', '/auth/me', { cookie: user.cookie })).data),
  ].join('');
  assert.ok(!/email|password_hash|@test\.com/i.test(responses));
});

test('errors: unknown API route is a JSON 404 and bad JSON is a clean 400', async () => {
  assert.equal((await call('GET', '/nothing-here')).status, 404);
  const res = await fetch(`${base}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(res.status, 400);
  assert.ok(!(await res.text()).includes('at '), 'no stack trace in the response');
});