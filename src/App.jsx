import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import { useStore } from './context/StoreContext';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';

export default function App() {
  const { ready, error, clearError } = useStore();
  return (
    <>
      <Header />
      <main>
        {error && (
          <div className="error-banner" role="alert">
            {error} <button className="link" onClick={clearError}>Dismiss</button>
          </div>
        )}
        {!ready ? <p className="empty">Loading…</p> : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
        )}
      </main>
    </>
  );
}
