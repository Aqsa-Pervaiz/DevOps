const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All item routes require a valid JWT
router.use(authMiddleware);

// GET /api/items - list current user's items
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM items WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/items - create a new item
router.post('/', async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO items (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, title, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id - update an item
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, completed } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const result = await pool.query(
      `UPDATE items SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        completed = COALESCE($3, completed),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [title, description, completed, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - delete an item
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
