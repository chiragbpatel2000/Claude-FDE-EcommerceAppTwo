import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { money, shippingFor } from '../utils/money';

const fields = [
  ['name', 'Full name'],
  ['email', 'Email'],
  ['address', 'Address'],
  ['city', 'City'],
  ['zip', 'ZIP / Postal code'],
];

export default function Checkout() {
  const { cart, subtotal, placeOrder } = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', address: '', city: '', zip: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (cart.length === 0)
    return <p className="empty">Nothing to check out. <Link to="/">Back to shop</Link></p>;

  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    fields.forEach(([k, label]) => { if (!form[k].trim()) errs[k] = `${label} is required`; });
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const order = await placeOrder(form);
      nav(`/orders?placed=${order.id}`);
    } catch (err) {
      setErrors({ form: err.message });
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout">
      <form onSubmit={submit} noValidate>
        <h1>Checkout</h1>
        {fields.map(([k, label]) => (
          <label key={k}>
            {label}
            <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            {errors[k] && <span className="err">{errors[k]}</span>}
          </label>
        ))}
        <p className="meta">Demo only — no payment is taken.</p>
        {errors.form && <p className="err">{errors.form}</p>}
        <button className="btn block" disabled={submitting}>
          {submitting ? 'Placing order…' : `Place order · ${money(total)}`}
        </button>
      </form>
      <aside className="summary">
        <h3>Order summary</h3>
        {cart.map(({ product, qty }) => (
          <div key={product.id}>
            <span>{product.emoji} {product.name} × {qty}</span>
            <span>{money(product.price * qty)}</span>
          </div>
        ))}
        <div><span>Shipping</span><span>{shipping ? money(shipping) : 'Free'}</span></div>
        <div className="total"><span>Total</span><span>{money(total)}</span></div>
      </aside>
    </div>
  );
}
