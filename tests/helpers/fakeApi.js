import { vi } from 'vitest';

export const PRODUCTS = [
  { id: 1, name: 'Wireless Headphones', category: 'Electronics', price: 89.99, emoji: '🎧', color: '#dbeafe', rating: 4.5, description: 'Great sound.', stock: 5 },
  { id: 2, name: 'Smart Watch', category: 'Electronics', price: 149, emoji: '⌚', color: '#e0e7ff', rating: 4.3, description: 'Tracks things.', stock: 3 },
  { id: 3, name: 'Yoga Mat', category: 'Sports', price: 28, emoji: '🧘', color: '#bbf7d0', rating: 4.6, description: 'Non-slip.', stock: 10 },
  { id: 4, name: 'Paperback Novel', category: 'Books', price: 11.99, emoji: '📖', color: '#fecaca', rating: 4.2, description: 'A thriller.', stock: 2 },
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const makeState = (over = {}) => ({
  products: clone(PRODUCTS), cart: [], wishlist: [], orders: [],
  failures: [], // regexes tested against "METHOD /path"; a match makes the call throw
  ...over,
});

function handle(state, path, { method = 'GET', body } = {}) {
  const key = `${method} ${path}`;
  if (state.failures.some((re) => re.test(key))) throw new Error('Server exploded');
  const find = (id) => state.products.find((p) => p.id === Number(id));
  let m;

  if (key === 'GET /products') return clone(state.products);
  if ((m = path.match(/^\/products\/(.+)$/)) && method === 'GET') {
    const p = Number.isInteger(Number(m[1])) ? find(m[1]) : null;
    if (!p) throw new Error(Number.isInteger(Number(m[1])) ? 'Product not found' : 'Invalid id');
    return clone(p);
  }

  if (key === 'GET /cart') return clone(state.cart);
  if (key === 'POST /cart/items') {
    const p = find(body.productId);
    if (!p) throw new Error('Product not found or out of stock');
    const row = state.cart.find((i) => i.product.id === p.id);
    if (row) row.qty = Math.min(row.qty + body.qty, p.stock);
    else state.cart.push({ product: p, qty: Math.min(body.qty, p.stock) });
    return clone(state.cart);
  }
  if ((m = path.match(/^\/cart\/items\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'DELETE' || (method === 'PUT' && body.qty === 0)) {
      state.cart = state.cart.filter((i) => i.product.id !== id);
    } else if (method === 'PUT') {
      const row = state.cart.find((i) => i.product.id === id);
      if (row) row.qty = Math.min(body.qty, row.product.stock);
    }
    return clone(state.cart);
  }

  if (key === 'GET /wishlist') return clone(state.wishlist);
  if ((m = path.match(/^\/wishlist\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'PUT' && !state.wishlist.includes(id)) state.wishlist.push(id);
    if (method === 'DELETE') state.wishlist = state.wishlist.filter((x) => x !== id);
    return clone(state.wishlist);
  }

  if (key === 'GET /orders') return clone(state.orders);
  if (key === 'POST /orders') {
    if (!state.cart.length) throw new Error('Cart is empty');
    const subtotal = state.cart.reduce((s, i) => s + i.product.price * i.qty, 0);
    const order = {
      id: 'ORD-TEST1',
      date: '2026-11-24T12:00:00.000Z',
      total: Math.round((subtotal + (subtotal >= 100 ? 0 : 5.99)) * 100) / 100,
      shipping: body.shipping,
      items: state.cart.map(({ product, qty }) => ({
        product: { id: product.id, name: product.name, emoji: product.emoji, price: product.price }, qty,
      })),
    };
    state.orders.unshift(order);
    state.cart = [];
    return clone(order);
  }
  throw new Error(`Unhandled fake route: ${key}`);
}

export const fake = {
  state: makeState(),
  request: vi.fn(),
  /** Reset to a clean backend; pass e.g. { cart: [...], wishlist: [1] } to preload state. */
  reset(over) {
    this.state = makeState(over);
    this.request.mockReset();
    this.request.mockImplementation(async (path, opts) => handle(this.state, path, opts));
  },
};
fake.reset();

export const cartRow = (id, qty) => ({ product: clone(PRODUCTS.find((p) => p.id === id)), qty });
