import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { money } from '../utils/money';

export default function Orders() {
  const { orders } = useStore();
  const [params] = useSearchParams();
  const placed = params.get('placed');
  return (
    <div>
      <h1>Your orders</h1>
      {placed && <div className="success">🎉 Order {placed} placed! Thanks for shopping.</div>}
      {orders.length === 0 && <p className="empty">No orders yet. <Link to="/">Start shopping</Link></p>}
      {orders.map((o) => (
        <div className="order" key={o.id}>
          <div className="row">
            <strong>{o.id}</strong>
            <span className="meta">{new Date(o.date).toLocaleString()}</span>
            <strong>{money(o.total)}</strong>
          </div>
          <ul>
            {o.items.map(({ product, qty }) => (
              <li key={product.id}>{product.emoji} {product.name} × {qty}</li>
            ))}
          </ul>
          <small>Ship to: {o.shipping.name}, {o.shipping.address}, {o.shipping.city} {o.shipping.zip}</small>
        </div>
      ))}
    </div>
  );
}
