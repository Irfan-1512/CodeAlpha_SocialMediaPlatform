const express = require('express');
const db = require('../db');
const { readUser, requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/limits');

const router = express.Router();

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const DIGITS = /^\d+$/;

// Counts are calculated in SQL. The first ? is the viewer id (0 = not logged in, no user has id 0).
const POST_SQL = `
  SELECT p.id, p.content, p.created_at,
    u.id AS author_id, u.username, u.name,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
    EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
  FROM posts p JOIN users u ON u.id = p.user_id`;

const shape = (row) => ({
  id: row.id,
  content: row.content,
  created_at: row.created_at,
  author: { id: row.author_id, username: row.username, name: row.name },
  like_count: row.like_count,
  comment_count: row.comment_count,
  liked_by_me: Boolean(row.liked_by_me),
});

const getPost = (id, viewerId) => db.prepare(`${POST_SQL} WHERE p.id = ?`).get(viewerId, id);

// GET /api/posts?feed=all&user=&before=&limit=
router.get('/', (req, res) => {
  const { feed, user, before, limit } = req.query;
  const isString = (v) => typeof v === 'string';

  if (feed !== undefined && feed !== 'all') {
    return res.status(400).json({ error: 'Invalid feed' });
  }
  if (before !== undefined && !(isString(before) && DIGITS.test(before))) {
    return res.status(400).json({ error: 'Invalid before value' });
  }
  if (limit !== undefined && !(isString(limit) && DIGITS.test(limit) && +limit >= 1 && +limit <= 50)) {
    return res.status(400).json({ error: 'Limit must be 1 to 50' });
  }
  const pageSize = limit === undefined ? 20 : Number(limit);

  const viewer = readUser(req);
  const where = [];
  const params = [viewer ? viewer.id : 0];

  if (user !== undefined) {
    const username = isString(user) ? user.toLowerCase() : '';
    const author = USERNAME_PATTERN.test(username)
      && db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!author) return res.status(404).json({ error: 'User not found' });
    where.push('p.user_id = ?');
    params.push(author.id);
  }
  if (before !== undefined) {
    where.push('p.id < ?');
    params.push(Number(before));
  }

  // Fetch one extra row to know whether more exist.
  const sql = `${POST_SQL}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY p.id DESC LIMIT ?`;
  params.push(pageSize + 1);
  const rows = db.prepare(sql).all(...params);

  res.json({ posts: rows.slice(0, pageSize).map(shape), has_more: rows.length > pageSize });
});

// POST /api/posts
router.post('/', writeLimiter, requireAuth, (req, res) => {
  const { content } = req.body || {};
  const text = typeof content === 'string' ? content.trim() : '';
  if (text.length < 1 || text.length > 280) {
    return res.status(400).json({ error: 'Post must be 1 to 280 characters' });
  }
  const info = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)').run(req.user.id, text);
  res.status(201).json(shape(getPost(info.lastInsertRowid, req.user.id)));
});

// GET /api/posts/:id
router.get('/:id', (req, res) => {
  const viewer = readUser(req);
  const row = DIGITS.test(req.params.id) && getPost(Number(req.params.id), viewer ? viewer.id : 0);
  if (!row) return res.status(404).json({ error: 'Post not found' });
  res.json(shape(row));
});

// DELETE /api/posts/:id: ownership is checked here on the server, never only in the browser
router.delete('/:id', writeLimiter, requireAuth, (req, res) => {
  const post = DIGITS.test(req.params.id)
    && db.prepare('SELECT user_id FROM posts WHERE id = ?').get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }
  // Comments and likes go with it through ON DELETE CASCADE.
  db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;