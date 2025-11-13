// server.js — Express API (register/login/products/orders)
require('dotenv').config();
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());

const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ message: 'No token' });
    const token = auth.split(' ')[1];
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

/* Register */
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Fill all fields' });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length) return res.status(400).json({ message: 'Email already exists' });
    const password_hash = await bcrypt.hash(password, 10);
    const insert = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, password_hash]
    );
    const user = insert.rows[0];
    const token = createToken({ id: user.id, email: user.email });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/* Login */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Fill all fields' });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(400).json({ message: 'User not found' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ message: 'Wrong password' });
    const token = createToken({ id: user.id, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/* Products */
app.get('/api/products', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/* Single product */
app.get('/api/products/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/* Orders (auth) */
app.post('/api/orders', authMiddleware, async (req, res) => {
  const { product_id, quantity, address, phone, payment_type } = req.body;
  if (!product_id || !quantity || !address || !phone) return res.status(400).json({ message: 'Bad order data' });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (!rows.length) return res.status(400).json({ message: 'Product not found' });
    const insert = await client.query(
      'INSERT INTO orders (user_id, product_id, quantity, address, phone, payment_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.user.id, product_id, quantity, address, phone, payment_type]
    );
    res.json({ orderId: insert.rows[0].id, message: 'Order created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/* My orders */
app.get('/api/my-orders', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT o.*, p.name AS product_name, p.price
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 4000;
// добавляем отдачу статических файлов фронтенда (если разворачиваем фронт и бэкенд в одном сервисе)
const path = require('path');
const frontendPath = path.join(__dirname, '..', 'frontend'); // если структура server/ и frontend/ на одном уровне

// Serve static assets
app.use(express.static(frontendPath));

// For SPA or to serve index.html on root and unknown routes:
app.get('*', (req, res, next) => {
  // если запрос к API — пропускаем дальше
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
