const rateLimit = require('express-rate-limit');

const make = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: message } });

module.exports = {
  authLimiter: make(15 * 60 * 1000, 10, 'Too many attempts. Please try again later.'),
  writeLimiter: make(60 * 1000, 60, 'Slow down a little and try again.'),
};