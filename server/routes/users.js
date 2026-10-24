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

module.exports = router;