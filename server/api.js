import { randomBytes } from 'node:crypto';
import express from 'express';
import { pool, query } from './db.js';

export const api = express.Router();
api.use(express.json());

const PRODUCT_COLS = `p.id, p.name, p.category, p.price::float8 AS price, p.emoji, p.color,
                      p.rating::float8 AS rating, p.description, p.stock`;

const FREE_SHIPPING_OVER = 100;
const shippingFor = (subtotal) => (subtotal === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : 5.99);
const round2 = (n) => Math.round(n * 100) / 100;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Wrap async handlers so rejections reach the error middleware (Express 5 does this too; explicit for clarity).
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const parseId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
};

// Identify the shopper. Anonymous for now; replace with the authenticated user later.
api.use((req, _res, next) => {
  const id = req.get('x-client-id');
  req.clientId = id && /^[\w-]{8,64}$/.test(id) ? id : null;
  next();
});
const needClient = (req, _res, next) =>
  req.clientId ? next() : next(new HttpError(400, 'Missing or invalid X-Client-Id header'));

api.get('/health', h(async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true });
}));

/* ---------- products ---------- */
api.get('/products', h(async (_req, res) => {
  const { rows } = await query(`SELECT ${PRODUCT_COLS} FROM products p ORDER BY p.id`);
  res.json(rows);
}));

api.get('/products/:id', h(async (req, res) => {
  const { rows } = await query(`SELECT ${PRODUCT_COLS} FROM products p WHERE p.id = $1`, [parseId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  res.json(rows[0]);
}));

/* ---------- cart ---------- */
const readCart = async (db, clientId, lock = false) => {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLS}, c.qty
       FROM cart_items c JOIN products p ON p.id = c.product_id
      WHERE c.client_id = $1 ORDER BY c.added_at, p.id ${lock ? 'FOR UPDATE OF p' : ''}`,
    [clientId]
  );
  return rows.map(({ qty, ...product }) => ({ product, qty }));
};

const parseQty = (v, min) => {
  if (!Number.isInteger(v) || v < min || v > 1000) throw new HttpError(400, 'Invalid quantity');
  return v;
};

api.get('/cart', needClient, h(async (req, res) => res.json(await readCart(pool, req.clientId))));

// Add (increments existing quantity, capped at stock)
api.post('/cart/items', needClient, h(async (req, res) => {
  const productId = parseId(req.body?.productId);
  const qty = parseQty(req.body?.qty ?? 1, 1);
  const r = await query(
    `INSERT INTO cart_items (client_id, product_id, qty)
     SELECT $1, id, LEAST($3, stock) FROM products WHERE id = $2 AND stock > 0
     ON CONFLICT (client_id, product_id)
       DO UPDATE SET qty = LEAST(cart_items.qty + $3, (SELECT stock FROM products WHERE id = $2))`,
    [req.clientId, productId, qty]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'Product not found or out of stock');
  res.json(await readCart(pool, req.clientId));
}));

// Set absolute quantity (0 removes)
api.put('/cart/items/:productId', needClient, h(async (req, res) => {
  const productId = parseId(req.params.productId);
  const qty = parseQty(req.body?.qty, 0);
  if (qty === 0) {
    await query('DELETE FROM cart_items WHERE client_id=$1 AND product_id=$2', [req.clientId, productId]);
  } else {
    await query(
      `UPDATE cart_items SET qty = LEAST($3, (SELECT stock FROM products WHERE id = $2))
        WHERE client_id = $1 AND product_id = $2`,
      [req.clientId, productId, qty]
    );
  }
  res.json(await readCart(pool, req.clientId));
}));

api.delete('/cart/items/:productId', needClient, h(async (req, res) => {
  await query('DELETE FROM cart_items WHERE client_id=$1 AND product_id=$2', [req.clientId, parseId(req.params.productId)]);
  res.json(await readCart(pool, req.clientId));
}));

/* ---------- wishlist ---------- */
const readWishlist = async (clientId) =>
  (await query('SELECT product_id FROM wishlist_items WHERE client_id=$1 ORDER BY product_id', [clientId]))
    .rows.map((r) => r.product_id);

api.get('/wishlist', needClient, h(async (req, res) => res.json(await readWishlist(req.clientId))));

api.put('/wishlist/:productId', needClient, h(async (req, res) => {
  const r = await query(
    `INSERT INTO wishlist_items (client_id, product_id) SELECT $1, id FROM products WHERE id = $2
     ON CONFLICT DO NOTHING`,
    [req.clientId, parseId(req.params.productId)]
  );
  // rowCount is 0 both for "already saved" and "no such product"; only the latter is an error.
  if (r.rowCount === 0 && !(await readWishlist(req.clientId)).includes(Number(req.params.productId)))
    throw new HttpError(404, 'Product not found');
  res.json(await readWishlist(req.clientId));
}));

api.delete('/wishlist/:productId', needClient, h(async (req, res) => {
  await query('DELETE FROM wishlist_items WHERE client_id=$1 AND product_id=$2', [req.clientId, parseId(req.params.productId)]);
  res.json(await readWishlist(req.clientId));
}));

/* ---------- orders ---------- */
const shapeOrders = (orders, items) =>
  orders.map((o) => ({
    id: o.id,
    date: o.created_at,
    total: o.total,
    shipping: o.shipping,
    items: items
      .filter((i) => i.order_id === o.id)
      .map((i) => ({ product: { id: i.product_id, name: i.name, emoji: i.emoji, price: i.price }, qty: i.qty })),
  }));

api.get('/orders', needClient, h(async (req, res) => {
  const orders = (await query(
    'SELECT id, total::float8 AS total, shipping, created_at FROM orders WHERE client_id=$1 ORDER BY created_at DESC',
    [req.clientId]
  )).rows;
  const items = orders.length
    ? (await query(
        `SELECT order_id, product_id, name, emoji, price::float8 AS price, qty
           FROM order_items WHERE order_id = ANY($1)`,
        [orders.map((o) => o.id)]
      )).rows
    : [];
  res.json(shapeOrders(orders, items));
}));

const SHIPPING_FIELDS = ['name', 'email', 'address', 'city', 'zip'];

api.post('/orders', needClient, h(async (req, res) => {
  const shipping = {};
  for (const f of SHIPPING_FIELDS) {
    const v = req.body?.shipping?.[f];
    if (typeof v !== 'string' || !v.trim() || v.length > 200) throw new HttpError(400, `Shipping ${f} is required`);
    shipping[f] = v.trim();
  }
  if (!/^\S+@\S+\.\S+$/.test(shipping.email)) throw new HttpError(400, 'Enter a valid email');

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const cart = await readCart(db, req.clientId, true); // locks product rows so stock can't oversell
    if (cart.length === 0) throw new HttpError(400, 'Cart is empty');
    for (const { product, qty } of cart)
      if (qty > product.stock) throw new HttpError(409, `Only ${product.stock} of "${product.name}" left in stock`);

    const subtotal = round2(cart.reduce((s, i) => s + i.product.price * i.qty, 0));
    const total = round2(subtotal + shippingFor(subtotal));
    const id = 'ORD-' + randomBytes(4).toString('hex').toUpperCase();

    const { rows } = await db.query(
      'INSERT INTO orders (id, client_id, total, shipping) VALUES ($1,$2,$3,$4) RETURNING created_at',
      [id, req.clientId, total, shipping]
    );
    for (const { product, qty } of cart) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, name, emoji, price, qty) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, product.id, product.name, product.emoji, product.price, qty]
      );
      await db.query('UPDATE products SET stock = stock - $2 WHERE id = $1', [product.id, qty]);
    }
    await db.query('DELETE FROM cart_items WHERE client_id = $1', [req.clientId]);
    await db.query('COMMIT');

    res.status(201).json({
      id, date: rows[0].created_at, total, shipping,
      items: cart.map(({ product, qty }) => ({
        product: { id: product.id, name: product.name, emoji: product.emoji, price: product.price }, qty,
      })),
    });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}));

/* ---------- errors ---------- */
api.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Invalid JSON');
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});
