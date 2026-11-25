import { useEffect, useMemo, useState } from 'react';
import { fetchProducts } from '../api/products';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [products, setProducts] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');

  const [loadError, setLoadError] = useState(null);

  useEffect(() => { fetchProducts().then(setProducts).catch((e) => setLoadError(e.message)); }, []);

  const categories = useMemo(() => ['All', ...new Set((products ?? []).map((p) => p.category))], [products]);

  const shown = useMemo(() => {
    if (!products) return [];
    const list = products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        p.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    if (sort === 'low') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') return [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, query, category, sort]);

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="featured">Featured</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
      <div className="chips">
        {categories.map((c) => (
          <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      {loadError ? (
        <p className="empty">Could not load products: {loadError}</p>
      ) : !products ? (
        <p className="empty">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="empty">No products match your search.</p>
      ) : (
        <div className="grid">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </>
  );
}
