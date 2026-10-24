const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { authLimiter } = require('../middleware/limits');
const { issueToken, clearToken, readUser, requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const ROUNDS = 12;
// Compared against when the email is unknown, so login timing doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

const isText = (value) => typeof value === 'string';

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, name, email, password } = req.body || {};

    const cleanUsername = isText(username) ? username.trim().toLowerCase() : '';
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3 to 20 letters, digits or underscores' });
    }
    if (!isText(name) || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Name must be 2 to 50 characters' });
    }
    if (!isText(email) || email.length > 254 || !EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    // bcrypt only uses the first 72 bytes, so longer passwords are rejected
    if (!isText(password) || password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'Password must be 8 to 72 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const hash = await bcrypt.hash(password, ROUNDS);

    try {
      const info = db
        .prepare('INSERT INTO users (username, name, email, password_hash) VALUES (?, ?, ?, ?)')
        .run(cleanUsername, name.trim(), cleanEmail, hash);
      res.status(201).json({ id: Number(info.lastInsertRowid), username: cleanUsername, name: name.trim() });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const field = err.message.includes('users.username') ? 'username' : 'email';
        return res.status(409).json({
          error: field === 'username' ? 'That username is already taken' : 'That email is already registered',
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isText(email) || !isText(password) || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db
      .prepare('SELECT id, username, name, password_hash FROM users WHERE email = ?')
      .get(email.trim().toLowerCase());

    const matches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !matches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    issueToken(res, user.id);
    res.json({ id: user.id, username: user.username, name: user.name });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

// GET /api/auth/me: lets the header show who is logged in
router.get('/me', (req, res) => {
  res.json({ user: readUser(req) });
});

module.exports = router;