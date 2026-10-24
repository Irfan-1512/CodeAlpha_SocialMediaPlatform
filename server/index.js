require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// Unknown API paths get a JSON 404.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// Routes are added phase by phase; unknown API paths get a JSON 404.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// One central error handler: log on the server, never leak details to clients.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
});

if (require.main === module) {
  // Refuse to run with a missing or placeholder secret.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
    console.error('Set a real JWT_SECRET in .env');
    process.exit(1);
  }
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`MoonCircle running on http://localhost:${port}`));
}

module.exports = app;