import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../api/products';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { wishlist } = useStore();
  const [products, setProducts] = useState(null);
  useEffect(() => { fetchProducts().then(setProducts).catch(() => setProducts([])); }, []);

  if (!products) return <p className="empty">Loading…</p>;
  const items = products.filter((p) => wishlist.includes(p.id));
  return (
    <>
      <h1>Wishlist</h1>
      {items.length === 0 ? (
        <p className="empty">Nothing saved yet. <Link to="/">Browse products</Link></p>
      ) : (
        <div className="grid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </>
  );
}
