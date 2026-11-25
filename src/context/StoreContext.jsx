import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { request } from '../api/client';

const StoreContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useStore = () => useContext(StoreContext);

// Server is the source of truth. Every mutation returns the new cart/wishlist, which we store as-is.
//   cart: [{ product, qty }]   wishlist: [productId]   orders: [{ id, date, items, total, shipping }]
export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([request('/cart'), request('/wishlist'), request('/orders')])
      .then(([c, w, o]) => { setCart(c); setWishlist(w); setOrders(o); })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);

  // Run a mutation; surface failures in a banner instead of throwing into event handlers.
  const run = useCallback(async (fn) => {
    try {
      setError(null);
      await fn();
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const addToCart = (product, qty = 1) =>
    run(async () => setCart(await request('/cart/items', { method: 'POST', body: { productId: product.id, qty } })));

  const setQty = (id, qty) =>
    run(async () => setCart(await request(`/cart/items/${id}`, { method: 'PUT', body: { qty } })));

  const removeFromCart = (id) =>
    run(async () => setCart(await request(`/cart/items/${id}`, { method: 'DELETE' })));

  const toggleWishlist = (id) =>
    run(async () =>
      setWishlist(await request(`/wishlist/${id}`, { method: wishlist.includes(id) ? 'DELETE' : 'PUT' }))
    );

  // Throws on failure so the checkout form can show the message.
  const placeOrder = async (shipping) => {
    const order = await request('/orders', { method: 'POST', body: { shipping } });
    setOrders((o) => [order, ...o]);
    setCart([]);
    return order;
  };

  const value = {
    cart, wishlist, orders, ready, error, clearError: () => setError(null),
    subtotal: cart.reduce((s, i) => s + i.product.price * i.qty, 0),
    cartCount: cart.reduce((s, i) => s + i.qty, 0),
    addToCart, setQty, removeFromCart, toggleWishlist, placeOrder,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
