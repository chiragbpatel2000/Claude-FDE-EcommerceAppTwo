import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { money } from '../utils/money';

export default function ProductCard({ product }) {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const liked = wishlist.includes(product.id);
  return (
    <div className="card">
      <button
        className={`heart ${liked ? 'on' : ''}`}
        onClick={() => toggleWishlist(product.id)}
        aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {liked ? '♥' : '♡'}
      </button>
      <Link to={`/product/${product.id}`}>
        <div className="thumb" style={{ background: product.color }}>{product.emoji}</div>
        <h3>{product.name}</h3>
      </Link>
      <div className="meta">
        <span className="rating">★ {product.rating}</span>
        <span>{product.category}</span>
      </div>
      <div className="row">
        <strong>{money(product.price)}</strong>
        <button className="btn" onClick={() => addToCart(product)}>Add to cart</button>
      </div>
    </div>
  );
}
