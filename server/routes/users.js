const express = require('express');
const db = require('../db');
const { readUser, requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/limits');

const router = express.Router();

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const isText = (value) => typeof value === 'string';

// Counts are calculated in SQL on every request. Email and password_hash are never selected.
const PROFILE_SQL = `
  SELECT u.id, u.username, u.name, u.bio, u.created_at,
    (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count,
    (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS follower_count,
    (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count
  FROM users u WHERE u.username = ?`;
// GET /api/users?q=: search by username or name (up to 10 results)
router.get('/', (req, res) => {
  const text = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (text.length < 1 || text.length > 50) {
    return res.status(400).json({ error: 'Search text must be 1 to 50 characters' });
  }
  // Escape LIKE wildcards so a typed % or _ is matched literally
  const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = db
    .prepare(
      `SELECT id, username, name, bio FROM users
       WHERE username LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'
       ORDER BY username LIMIT 10`
    )
    .all(pattern, pattern);
  res.json(rows);
});

// GET /api/users/:username
router.get('/:username', (req, res) => {
  const username = req.params.username.toLowerCase();
  const profile = USERNAME_PATTERN.test(username) && db.prepare(PROFILE_SQL).get(username);
  if (!profile) return res.status(404).json({ error: 'User not found' });

  const viewer = readUser(req);
  profile.is_me = Boolean(viewer && viewer.id === profile.id);
  profile.is_following = Boolean(
    viewer &&
      db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(viewer.id, profile.id)
  );
  res.json(profile);
});

// PATCH /api/users/me
router.patch('/me', writeLimiter, requireAuth, (req, res) => {
  const { name, bio } = req.body || {};
  if (name === undefined && bio === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  if (name !== undefined && (!isText(name) || name.trim().length < 2 || name.trim().length > 50)) {
    return res.status(400).json({ error: 'Name must be 2 to 50 characters' });
  }
  if (bio !== undefined && (!isText(bio) || bio.trim().length > 160)) {
    return res.status(400).json({ error: 'Bio can be up to 160 characters' });
  }

  // COALESCE keeps the old value for a field that was not sent
  db.prepare('UPDATE users SET name = COALESCE(?, name), bio = COALESCE(?, bio) WHERE id = ?').run(
    name === undefined ? null : name.trim(),
    bio === undefined ? null : bio.trim(),
    req.user.id
  );
  res.json(db.prepare('SELECT name, bio FROM users WHERE id = ?').get(req.user.id));
});
// POST and DELETE /api/users/:username/follow: both are safe to repeat
function setFollow(following) {
  return (req, res) => {
    const username = req.params.username.toLowerCase();
    const target = USERNAME_PATTERN.test(username)
      && db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });

    if (following) {
      db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
    } else {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
    }
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?').get(target.id);
    res.json({ following, follower_count: n });
  };
}
router.post('/:username/follow', writeLimiter, requireAuth, setFollow(true));
router.delete('/:username/follow', writeLimiter, requireAuth, setFollow(false));

module.exports = router;