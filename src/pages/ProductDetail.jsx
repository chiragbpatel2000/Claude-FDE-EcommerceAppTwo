import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProduct } from '../api/products';
import { useStore } from '../context/StoreContext';
import { money } from '../utils/money';

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const [product, setProduct] = useState(undefined);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let live = true;
    fetchProduct(id)
      .then((p) => live && setProduct(p))
      .catch((e) => live && setLoadError(e.message));
    return () => { live = false; };
  }, [id]);

  if (loadError) return <p className="empty">Could not load product: {loadError}</p>;
  if (product === undefined) return <p className="empty">Loading…</p>;
  if (product === null)
    return <p className="empty">Product not found. <Link to="/">Back to shop</Link></p>;

  const liked = wishlist.includes(product.id);
  const add = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="detail">
      <div className="big-thumb" style={{ background: product.color }}>{product.emoji}</div>
      <div>
        <Link to="/" className="back">← Back to shop</Link>
        <h1>{product.name}</h1>
        <p className="meta"><span className="rating">★ {product.rating}</span> · {product.category}</p>
        <p className="price">{money(product.price)}</p>
        <p>{product.description}</p>
        <p className="stock">{product.stock} in stock</p>
        <div className="row gap">
          <input
            type="number" min="1" max={product.stock} value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
          />
          <button className="btn" onClick={add}>{added ? 'Added ✓' : 'Add to cart'}</button>
          <button className="btn ghost" onClick={() => toggleWishlist(product.id)}>
            {liked ? '♥ Saved' : '♡ Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
