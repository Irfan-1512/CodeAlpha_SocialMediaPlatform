const rateLimit = require('express-rate-limit');

// Limits are skipped only under the test runner, so the test suite can make many requests.
const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    skip: () => process.env.NODE_ENV === 'test',
  });

module.exports = {
  authLimiter: make(15 * 60 * 1000, 10, 'Too many attempts. Please try again later.'),
  writeLimiter: make(60 * 1000, 60, 'Slow down a little and try again.'),
};