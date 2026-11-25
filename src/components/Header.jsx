import { Link, NavLink } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function Header() {
  const { cartCount, wishlist } = useStore();
  return (
    <header className="header">
      <Link to="/" className="logo">🪺 MarketNest</Link>
      <nav>
        <NavLink to="/" end>Shop</NavLink>
        <NavLink to="/wishlist">♥ Wishlist ({wishlist.length})</NavLink>
        <NavLink to="/orders">Orders</NavLink>
        <NavLink to="/cart">
          🛒 Cart
          {cartCount > 0 && <span className="badge">{cartCount}</span>}
        </NavLink>
      </nav>
    </header>
  );
}
