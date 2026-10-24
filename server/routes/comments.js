const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/limits');

const router = express.Router();

// DELETE /api/comments/:id: only the comment's author; post owners cannot delete others' comments
router.delete('/:id', writeLimiter, requireAuth, (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : 0;
  const comment = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own comments' });
  }
  db.prepare('DELETE FROM comments WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;