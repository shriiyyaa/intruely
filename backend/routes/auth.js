const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'intruely_secret_dev_key';
const JWT_EXPIRES = '30d'; // 30-day sessions

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    // Check existing user
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, avatar_initials) VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar_initials, created_at',
      [name.trim(), email.toLowerCase().trim(), passwordHash, initials]
    );

    const user = result.rows[0];

    // Create default General mode for new user
    await pool.query(
      'INSERT INTO modes (user_id, name, prompt, is_active) VALUES ($1, $2, $3, $4)',
      [user.id, 'General', 'You are Intruely, a real-time AI meeting and interview assistant. Provide clear, concise, expert-level answers.', true]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar_initials }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const result = await pool.query(
      'SELECT id, name, email, password_hash, avatar_initials FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'No account found with this email.' });

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid)
      return res.status(401).json({ error: 'Incorrect password.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar_initials }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /auth/me — verify token + get profile
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, avatar_initials, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User not found.' });

    const user = result.rows[0];
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar_initials } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

module.exports = router;
