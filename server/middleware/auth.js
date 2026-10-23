const jwt = require('jsonwebtoken');
const db = require('../db');

const secret = process.env.JWT_SECRET;
if (!secret || secret.startsWith('change-me')) {
  throw new Error('Set a long random JWT_SECRET in your .env file before starting the server.');
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: MAX_AGE_MS,
};

function issueToken(res, userId) {
  const token = jwt.sign({ id: userId }, secret, { expiresIn: '7d' });
  res.cookie('token', token, cookieOptions);
}

function clearToken(res) {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: cookieOptions.secure });
}

// Returns the logged-in user, or null (missing, expired, tampered or deleted-user token).
// Email is deliberately not selected: it must never leave the server.
function readUser(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, secret);
    return db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(id) || null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = readUser(req);
  if (!user) return res.status(401).json({ error: 'Please log in' });
  req.user = user;
  next();
}

module.exports = { issueToken, clearToken, readUser, requireAuth };