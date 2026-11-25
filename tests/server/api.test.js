// @vitest-environment node
import express from 'express';
import request from 'supertest';
import { vi } from 'vitest';

// Replace the Neon pool with an in-memory Postgres (PGlite) so the real SQL in server/api.js runs.
// `control` lets a test make matching statements fail to exercise error handling / rollback.
vi.mock('../../server/db.js', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { schema } = await import('../../server/schema.js');
  const { products } = await import('../../server/seed.js');
  const db = new PGlite();
  await db.exec(schema);
  for (const p of products)
    await db.query(
      'INSERT INTO products (id,name,category,price,emoji,color,rating,description,stock) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [p.id, p.name, p.category, p.price, p.emoji, p.color, p.rating, p.description, p.stock]
    );
  const control = { failOn: null };
  const run = async (text, params) => {
    if (control.failOn?.test(text)) throw new Error('simulated db failure');
    const r = await db.query(text, params);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  return {
    control,
    query: run,
    pool: { query: run, connect: async () => ({ query: run, release() {} }) },
  };
});

const { api } = await import('../../server/api.js');
const { control } = await import('../../server/db.js');

const app = express().use('/api', api);
let n = 0;
const newClient = () => `client-${String(++n).padStart(4, '0')}-test`;
const as = (id) => ({
  get: (u) => request(app).get(u).set('X-Client-Id', id),
  post: (u, b) => request(app).post(u).set('X-Client-Id', id).send(b),
  put: (u, b) => request(app).put(u).set('X-Client-Id', id).send(b),
  del: (u) => request(app).delete(u).set('X-Client-Id', id),
});
const ship = { name: 'Ann Lee', email: 'ann@example.com', address: '1 Main St', city: 'Town', zip: '12345' };

afterEach(() => { control.failOn = null; });
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('health', () => {
  it('reports ok when the database answers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 500 with a generic message when the database fails (no leak)', async () => {
    control.failOn = /SELECT 1/;
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('products', () => {
  it('lists all products with numeric price and rating', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(16);
    expect(res.body[0]).toMatchObject({ id: 1, name: 'Wireless Headphones', price: 89.99, rating: 4.5 });
    expect(typeof res.body[0].price).toBe('number');
    expect(res.body.map((p) => p.id)).toEqual([...Array(16).keys()].map((i) => i + 1));
  });

  it('returns one product', async () => {
    const res = await request(app).get('/api/products/3');
    expect(res.body).toMatchObject({ id: 3, name: 'Mechanical Keyboard', category: 'Electronics' });
  });

  it('404s an unknown product and 400s a malformed id', async () => {
    expect((await request(app).get('/api/products/999')).status).toBe(404);
    for (const bad of ['abc', '0', '-1', '1.5'])
      expect((await request(app).get(`/api/products/${bad}`)).status).toBe(400);
  });
});

describe('client identity', () => {
  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['bad characters', 'has spaces and ; semicolons'],
    ['too long', 'x'.repeat(65)],
  ])('rejects a %s X-Client-Id', async (_label, id) => {
    const req = request(app).get('/api/cart');
    const res = await (id === undefined ? req : req.set('X-Client-Id', id));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/client-id/i);
  });

  it('public product routes do not need it', async () => {
    expect((await request(app).get('/api/products')).status).toBe(200);
  });
});

describe('cart', () => {
  it('starts empty', async () => {
    expect((await as(newClient()).get('/api/cart')).body).toEqual([]);
  });

  it('adds, increments, and returns product details', async () => {
    const c = as(newClient());
    let res = await c.post('/api/cart/items', { productId: 2, qty: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ qty: 2, product: { id: 2, name: 'Smart Watch', price: 149 } });
    res = await c.post('/api/cart/items', { productId: 2 }); // qty defaults to 1
    expect(res.body[0].qty).toBe(3);
  });

  it('caps quantity at stock on add and on set', async () => {
    const c = as(newClient());
    const stock = (await request(app).get('/api/products/4')).body.stock;
    let res = await c.post('/api/cart/items', { productId: 4, qty: 1000 });
    expect(res.body[0].qty).toBe(stock);
    res = await c.post('/api/cart/items', { productId: 4, qty: 5 });
    expect(res.body[0].qty).toBe(stock);
    res = await c.put('/api/cart/items/4', { qty: 1 });
    expect(res.body[0].qty).toBe(1);
    res = await c.put('/api/cart/items/4', { qty: 1000 });
    expect(res.body[0].qty).toBe(stock);
  });

  it('404s adding a missing product', async () => {
    expect((await as(newClient()).post('/api/cart/items', { productId: 999 })).status).toBe(404);
  });

  it.each([
    [{ productId: 1, qty: 0 }],
    [{ productId: 1, qty: -2 }],
    [{ productId: 1, qty: 1.5 }],
    [{ productId: 1, qty: '2' }],
    [{ productId: 1, qty: 1001 }],
    [{ productId: 'x' }],
    [{}],
  ])('rejects invalid add body %j', async (body) => {
    expect((await as(newClient()).post('/api/cart/items', body)).status).toBe(400);
  });

  it('removes with qty 0 or DELETE, and both are idempotent', async () => {
    const c = as(newClient());
    await c.post('/api/cart/items', { productId: 1 });
    await c.post('/api/cart/items', { productId: 2 });
    expect((await c.put('/api/cart/items/1', { qty: 0 })).body.map((i) => i.product.id)).toEqual([2]);
    expect((await c.del('/api/cart/items/2')).body).toEqual([]);
    expect((await c.del('/api/cart/items/2')).status).toBe(200);
  });

  it('setting qty on an item not in the cart changes nothing', async () => {
    const c = as(newClient());
    expect((await c.put('/api/cart/items/5', { qty: 2 })).body).toEqual([]);
  });

  it('rejects an invalid qty on PUT', async () => {
    const c = as(newClient());
    expect((await c.put('/api/cart/items/1', { qty: -1 })).status).toBe(400);
    expect((await c.put('/api/cart/items/1', {})).status).toBe(400);
  });

  it('keeps carts separate per client and keeps insertion order', async () => {
    const a = as(newClient()), b = as(newClient());
    await a.post('/api/cart/items', { productId: 5 });
    await a.post('/api/cart/items', { productId: 1 });
    expect((await a.get('/api/cart')).body.map((i) => i.product.id)).toEqual([5, 1]);
    expect((await b.get('/api/cart')).body).toEqual([]);
  });
});

describe('wishlist', () => {
  it('adds, is idempotent, and removes', async () => {
    const c = as(newClient());
    expect((await c.get('/api/wishlist')).body).toEqual([]);
    expect((await c.put('/api/wishlist/7')).body).toEqual([7]);
    expect((await c.put('/api/wishlist/7')).body).toEqual([7]);
    expect((await c.put('/api/wishlist/2')).body).toEqual([2, 7]);
    expect((await c.del('/api/wishlist/7')).body).toEqual([2]);
    expect((await c.del('/api/wishlist/7')).status).toBe(200);
  });

  it('404s an unknown product, 400s a bad id, and isolates clients', async () => {
    const a = as(newClient()), b = as(newClient());
    expect((await a.put('/api/wishlist/999')).status).toBe(404);
    expect((await a.put('/api/wishlist/abc')).status).toBe(400);
    await a.put('/api/wishlist/1');
    expect((await b.get('/api/wishlist')).body).toEqual([]);
  });
});

describe('orders', () => {
  it('validates each shipping field', async () => {
    const c = as(newClient());
    await c.post('/api/cart/items', { productId: 1 });
    for (const f of Object.keys(ship)) {
      const bad = { ...ship, [f]: '   ' };
      const res = await c.post('/api/orders', { shipping: bad });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(new RegExp(f));
    }
    expect((await c.post('/api/orders', {})).status).toBe(400);
    expect((await c.post('/api/orders', { shipping: { ...ship, name: 'x'.repeat(201) } })).status).toBe(400);
    expect((await c.post('/api/orders', { shipping: { ...ship, zip: 12345 } })).status).toBe(400);
    expect((await c.post('/api/orders', { shipping: { ...ship, email: 'nope' } })).body.error).toMatch(/email/i);
    expect((await c.get('/api/cart')).body).toHaveLength(1); // nothing consumed
  });

  it('rejects an empty cart', async () => {
    const res = await as(newClient()).post('/api/orders', { shipping: ship });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });

  it('places an order: server-side total with shipping, stock decrement, cart cleared', async () => {
    const c = as(newClient());
    const before = (await request(app).get('/api/products/13')).body.stock;
    await c.post('/api/cart/items', { productId: 13, qty: 2 }); // 2 x 28.00 = 56.00
    const res = await c.post('/api/orders', { shipping: { ...ship, name: '  Ann Lee  ' } });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^ORD-[0-9A-F]{8}$/);
    expect(res.body.total).toBe(61.99); // + 5.99 shipping
    expect(res.body.shipping.name).toBe('Ann Lee'); // trimmed
    expect(res.body.items).toEqual([{ product: { id: 13, name: 'Yoga Mat', emoji: '🧘', price: 28 }, qty: 2 }]);
    expect((await request(app).get('/api/products/13')).body.stock).toBe(before - 2);
    expect((await c.get('/api/cart')).body).toEqual([]);
  });

  it('ships free at $100 or more', async () => {
    const c = as(newClient());
    await c.post('/api/cart/items', { productId: 2 }); // 149
    expect((await c.post('/api/orders', { shipping: ship })).body.total).toBe(149);
  });

  it('rounds totals to cents', async () => {
    const c = as(newClient());
    await c.post('/api/cart/items', { productId: 16, qty: 3 }); // 3 x 11.99 = 35.97
    expect((await c.post('/api/orders', { shipping: ship })).body.total).toBe(41.96);
  });

  it('lists the client’s orders newest first, with item snapshots', async () => {
    const c = as(newClient());
    await c.post('/api/cart/items', { productId: 11 });
    const first = (await c.post('/api/orders', { shipping: ship })).body;
    await new Promise((r) => setTimeout(r, 15));
    await c.post('/api/cart/items', { productId: 12, qty: 2 });
    const second = (await c.post('/api/orders', { shipping: ship })).body;
    const list = (await c.get('/api/orders')).body;
    expect(list.map((o) => o.id)).toEqual([second.id, first.id]);
    expect(list[1].items[0].product).toMatchObject({ name: 'Indoor Plant', price: 19 });
    expect(list[0].items[0].qty).toBe(2);
    expect(list[0].shipping).toMatchObject(ship);
    expect(list[0].date).toBeTruthy();
  });

  it('returns an empty list for a client with no orders and isolates clients', async () => {
    const a = as(newClient()), b = as(newClient());
    await a.post('/api/cart/items', { productId: 10 });
    await a.post('/api/orders', { shipping: ship });
    expect((await b.get('/api/orders')).body).toEqual([]);
  });

  it('keeps the historical price after the catalog price changes', async () => {
    const c = as(newClient());
    await c.post('/api/cart/items', { productId: 9 });
    const { id } = (await c.post('/api/orders', { shipping: ship })).body;
    const { query } = await import('../../server/db.js');
    await query('UPDATE products SET price = 999 WHERE id = 9');
    const order = (await c.get('/api/orders')).body.find((o) => o.id === id);
    expect(order.items[0].product.price).toBe(24);
    await query('UPDATE products SET price = 24 WHERE id = 9');
  });

  it('409s when the cart holds more than is now in stock, and changes nothing', async () => {
    const a = as(newClient()), b = as(newClient());
    const stock = (await request(app).get('/api/products/15')).body.stock;
    await a.post('/api/cart/items', { productId: 15, qty: stock });
    await b.post('/api/cart/items', { productId: 15, qty: stock });
    expect((await b.post('/api/orders', { shipping: ship })).status).toBe(201);
    const res = await a.post('/api/orders', { shipping: ship });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Water Bottle/);
    expect((await a.get('/api/cart')).body).toHaveLength(1);
    expect((await a.get('/api/orders')).body).toEqual([]);
    expect((await request(app).get('/api/products/15')).body.stock).toBe(0);
  });

  it('cannot add an out-of-stock product', async () => {
    expect((await as(newClient()).post('/api/cart/items', { productId: 15 })).status).toBe(404);
  });

  it('rolls everything back if a statement fails mid-transaction', async () => {
    const c = as(newClient());
    const before = (await request(app).get('/api/products/14')).body.stock;
    await c.post('/api/cart/items', { productId: 14, qty: 2 });
    control.failOn = /INSERT INTO order_items/;
    const res = await c.post('/api/orders', { shipping: ship });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    control.failOn = null;
    expect((await c.get('/api/orders')).body).toEqual([]);
    expect((await c.get('/api/cart')).body).toHaveLength(1);
    expect((await request(app).get('/api/products/14')).body.stock).toBe(before);
  });
});

describe('error handling', () => {
  it('404s unknown API routes with JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('400s malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Client-Id', newClient())
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('does not leak SQL errors from product reads', async () => {
    control.failOn = /FROM products p/;
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/simulated|SELECT/);
  });
});
