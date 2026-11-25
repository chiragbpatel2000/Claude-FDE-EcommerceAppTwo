import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { FREE_SHIPPING_OVER, money, shippingFor } from '../utils/money';

export default function Cart() {
  const { cart, setQty, removeFromCart, subtotal } = useStore();
  if (cart.length === 0)
    return <p className="empty">Your cart is empty. <Link to="/">Start shopping</Link></p>;
  const shipping = shippingFor(subtotal);
  return (
    <div>
      <h1>Your cart</h1>
      {cart.map(({ product, qty }) => (
        <div className="cart-row" key={product.id}>
          <div className="mini" style={{ background: product.color }}>{product.emoji}</div>
          <div className="grow">
            <Link to={`/product/${product.id}`}>{product.name}</Link>
            <div className="meta">{money(product.price)} each</div>
          </div>
          <div className="qty">
            <button onClick={() => setQty(product.id, qty - 1)} aria-label="Decrease">−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(product.id, qty + 1)} disabled={qty >= product.stock} aria-label="Increase">+</button>
          </div>
          <strong className="line">{money(product.price * qty)}</strong>
          <button className="link" onClick={() => removeFromCart(product.id)}>Remove</button>
        </div>
      ))}
      <div className="summary">
        <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div><span>Shipping</span><span>{shipping ? money(shipping) : 'Free'}</span></div>
        <div className="total"><span>Total</span><span>{money(subtotal + shipping)}</span></div>
        {shipping > 0 && <small>Free shipping over {money(FREE_SHIPPING_OVER)}</small>}
        <Link to="/checkout" className="btn block">Checkout</Link>
      </div>
    </div>
  );
}
