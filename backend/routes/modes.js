const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET /modes — Fetch all modes for logged in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, prompt, is_active, updated_at FROM modes WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ modes: result.rows });
  } catch (err) {
    console.error('Fetch modes error:', err);
    res.status(500).json({ error: 'Failed to fetch modes.' });
  }
});

// POST /modes — Create a new mode
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, prompt } = req.body;
    const result = await pool.query(
      'INSERT INTO modes (user_id, name, prompt, is_active) VALUES ($1, $2, $3, false) RETURNING *',
      [req.user.id, name || 'Untitled Mode', prompt || '']
    );
    res.status(201).json({ mode: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create mode.' });
  }
});

// PUT /modes/:id — Update mode prompt or active status
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, prompt, is_active } = req.body;

    if (is_active) {
      // Deactivate all other modes for user
      await pool.query('UPDATE modes SET is_active = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      'UPDATE modes SET name = COALESCE($1, name), prompt = COALESCE($2, prompt), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, prompt, is_active, id, req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Mode not found.' });

    res.json({ mode: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update mode.' });
  }
});

// DELETE /modes/:id — Delete mode
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM modes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Mode deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete mode.' });
  }
});

module.exports = router;
