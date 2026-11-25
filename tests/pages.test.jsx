import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { cartRow, fake } from './helpers/fakeApi';
import { renderApp } from './helpers/render';

const cardNames = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('Home', () => {
  it('lists every product and a chip per category', async () => {
    await renderApp();
    expect(cardNames()).toEqual(['Wireless Headphones', 'Smart Watch', 'Yoga Mat', 'Paperback Novel']);
    for (const c of ['All', 'Electronics', 'Sports', 'Books'])
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
  });

  it('searches case-insensitively and ignores surrounding spaces', async () => {
    const { user } = await renderApp();
    await user.type(screen.getByPlaceholderText(/search/i), '  YOGA ');
    expect(cardNames()).toEqual(['Yoga Mat']);
  });

  it('shows an empty state when nothing matches', async () => {
    const { user } = await renderApp();
    await user.type(screen.getByPlaceholderText(/search/i), 'zzz');
    expect(screen.getByText(/no products match/i)).toBeInTheDocument();
  });

  it('filters by category and combines it with search', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Electronics' }));
    expect(cardNames()).toEqual(['Wireless Headphones', 'Smart Watch']);
    expect(screen.getByRole('button', { name: 'Electronics' })).toHaveClass('active');
    await user.type(screen.getByPlaceholderText(/search/i), 'watch');
    expect(cardNames()).toEqual(['Smart Watch']);
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(cardNames()).toEqual(['Smart Watch']);
  });

  it.each([
    ['low', ['Paperback Novel', 'Yoga Mat', 'Wireless Headphones', 'Smart Watch']],
    ['high', ['Smart Watch', 'Wireless Headphones', 'Yoga Mat', 'Paperback Novel']],
    ['rating', ['Yoga Mat', 'Wireless Headphones', 'Smart Watch', 'Paperback Novel']],
    ['featured', ['Wireless Headphones', 'Smart Watch', 'Yoga Mat', 'Paperback Novel']],
  ])('sorts by %s', async (value, expected) => {
    const { user } = await renderApp();
    await user.selectOptions(screen.getByRole('combobox'), 'low'); // change away from default first
    await user.selectOptions(screen.getByRole('combobox'), value);
    expect(cardNames()).toEqual(expected);
  });

  it('shows an error when products fail to load', async () => {
    fake.state.failures.push(/GET \/products$/);
    await renderApp();
    expect(await screen.findByText(/could not load products: server exploded/i)).toBeInTheDocument();
  });
});

describe('ProductDetail', () => {
  it('shows the product details', async () => {
    await renderApp('/product/1');
    expect(await screen.findByRole('heading', { name: 'Wireless Headphones', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('$89.99')).toBeInTheDocument();
    expect(screen.getByText('Great sound.')).toBeInTheDocument();
    expect(screen.getByText('5 in stock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to shop/i })).toHaveAttribute('href', '/');
  });

  it('adds the chosen quantity to the cart and flashes a confirmation', async () => {
    const { user } = await renderApp('/product/1');
    const qty = await screen.findByRole('spinbutton');
    fireEvent.change(qty, { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(await screen.findByRole('button', { name: /added/i })).toBeInTheDocument();
    expect(fake.state.cart[0].qty).toBe(3);
    await waitFor(() => expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument(), { timeout: 3000 });
  });

  it('clamps the quantity between 1 and stock', async () => {
    await renderApp('/product/4'); // stock 2
    const qty = await screen.findByRole('spinbutton');
    fireEvent.change(qty, { target: { value: '50' } });
    expect(qty).toHaveValue(2);
    fireEvent.change(qty, { target: { value: '0' } });
    expect(qty).toHaveValue(1);
    fireEvent.change(qty, { target: { value: '' } });
    expect(qty).toHaveValue(1);
  });

  it('saves and unsaves to the wishlist', async () => {
    const { user } = await renderApp('/product/2');
    await user.click(await screen.findByRole('button', { name: /save/i }));
    expect(await screen.findByRole('button', { name: /saved/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /saved/i }));
    expect(await screen.findByRole('button', { name: /♡ save/i })).toBeInTheDocument();
  });

  it('handles an unknown product', async () => {
    await renderApp('/product/999');
    expect(await screen.findByText(/product not found/i)).toBeInTheDocument();
  });

  it('handles a server error', async () => {
    fake.state.failures.push(/GET \/products\/1$/);
    await renderApp('/product/1');
    expect(await screen.findByText(/could not load product: server exploded/i)).toBeInTheDocument();
  });

  it('reloads when navigating between products', async () => {
    const { user } = await renderApp('/product/1');
    await screen.findByRole('heading', { name: 'Wireless Headphones', level: 1 });
    expect(screen.getByRole('link', { name: /marketnest/i })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /back to shop/i }));
    await user.click(await screen.findByRole('link', { name: /Yoga Mat/ }));
    expect(await screen.findByRole('heading', { name: 'Yoga Mat', level: 1 })).toBeInTheDocument();
  });
});

describe('Cart', () => {
  it('shows an empty state', async () => {
    await renderApp('/cart');
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start shopping/i })).toHaveAttribute('href', '/');
  });

  it('lists items with line totals and charges shipping below $100', async () => {
    fake.reset({ cart: [cartRow(1, 1)] });
    await renderApp('/cart');
    expect(screen.getByText('89.99 each', { exact: false })).toBeInTheDocument();
    const summary = screen.getByText('Subtotal').closest('.summary');
    expect(within(summary).getByText('$89.99')).toBeInTheDocument();
    expect(within(summary).getByText('$5.99')).toBeInTheDocument();
    expect(within(summary).getByText('$95.98')).toBeInTheDocument();
    expect(within(summary).getByText(/free shipping over \$100\.00/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout');
  });

  it('gives free shipping at $100 or more', async () => {
    fake.reset({ cart: [cartRow(2, 1)] });
    await renderApp('/cart');
    const summary = screen.getByText('Subtotal').closest('.summary');
    expect(within(summary).getByText('Free')).toBeInTheDocument();
    expect(within(summary).queryByText(/free shipping over/i)).not.toBeInTheDocument();
  });

  it('changes quantity, respects stock and removes at zero', async () => {
    fake.reset({ cart: [cartRow(4, 1)] }); // stock 2
    const { user } = await renderApp('/cart');
    const plus = screen.getByRole('button', { name: 'Increase' });
    await user.click(plus);
    expect(await screen.findByText('2', { selector: '.qty span' })).toBeInTheDocument();
    expect(plus).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Decrease' }));
    await user.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('removes an item', async () => {
    fake.reset({ cart: [cartRow(1, 1), cartRow(3, 1)] });
    const { user } = await renderApp('/cart');
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Wireless Headphones' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Yoga Mat' })).toBeInTheDocument();
  });
});

describe('Checkout', () => {
  const fill = async (user, over = {}) => {
    const v = { name: 'Ann Lee', email: 'ann@example.com', address: '1 Main St', city: 'Town', zip: '12345', ...over };
    await user.type(screen.getByLabelText(/full name/i), v.name);
    await user.type(screen.getByLabelText(/email/i), v.email);
    await user.type(screen.getByLabelText(/address/i), v.address);
    await user.type(screen.getByLabelText(/city/i), v.city);
    await user.type(screen.getByLabelText(/zip/i), v.zip);
  };

  it('has nothing to check out when the cart is empty', async () => {
    await renderApp('/checkout');
    expect(screen.getByText(/nothing to check out/i)).toBeInTheDocument();
  });

  it('shows the order summary with totals', async () => {
    fake.reset({ cart: [cartRow(3, 2)] });
    await renderApp('/checkout');
    const summary = screen.getByRole('complementary');
    expect(within(summary).getByText(/yoga mat × 2/i)).toBeInTheDocument();
    expect(within(summary).getByText('$61.99')).toBeInTheDocument(); // 56 + 5.99
    expect(screen.getByRole('button', { name: /place order · \$61\.99/i })).toBeInTheDocument();
  });

  it('validates required fields without calling the server', async () => {
    fake.reset({ cart: [cartRow(3, 1)] });
    const { user } = await renderApp('/checkout');
    fake.request.mockClear();
    await user.click(screen.getByRole('button', { name: /place order/i }));
    for (const f of ['Full name', 'Email', 'Address', 'City', 'ZIP / Postal code'])
      expect(screen.getByText(`${f} is required`)).toBeInTheDocument();
    expect(fake.request).not.toHaveBeenCalled();
  });

  it('validates the email format', async () => {
    fake.reset({ cart: [cartRow(3, 1)] });
    const { user } = await renderApp('/checkout');
    await fill(user, { email: 'not-an-email' });
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(fake.state.orders).toHaveLength(0);
  });

  it('places the order, clears the cart and lands on the orders page', async () => {
    fake.reset({ cart: [cartRow(1, 1)] });
    const { user } = await renderApp('/checkout');
    await fill(user);
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByText(/order ORD-TEST1 placed/i)).toBeInTheDocument();
    expect(screen.getByText(/Ship to: Ann Lee, 1 Main St, Town 12345/)).toBeInTheDocument();
    expect(fake.state.cart).toHaveLength(0);
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: /cart/i }).textContent).not.toMatch(/\d/);
  });

  it('shows the server error and lets you retry', async () => {
    fake.reset({ cart: [cartRow(1, 1)] });
    fake.state.failures.push(/POST \/orders/);
    const { user } = await renderApp('/checkout');
    await fill(user);
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /place order/i })).toBeEnabled();
  });
});

describe('Orders', () => {
  it('shows an empty state', async () => {
    await renderApp('/orders');
    expect(screen.getByText(/no orders yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/placed!/i)).not.toBeInTheDocument();
  });

  it('lists past orders', async () => {
    fake.reset({
      orders: [{
        id: 'ORD-ABC', date: '2026-11-24T12:00:00.000Z', total: 95.98,
        shipping: { name: 'Bob', email: 'b@x.co', address: '2 Side St', city: 'City', zip: '999' },
        items: [{ product: { id: 1, name: 'Wireless Headphones', emoji: '🎧', price: 89.99 }, qty: 2 }],
      }],
    });
    await renderApp('/orders?placed=ORD-ABC');
    expect(screen.getByText('ORD-ABC')).toBeInTheDocument();
    expect(screen.getByText('$95.98')).toBeInTheDocument();
    expect(screen.getByText(/Wireless Headphones × 2/)).toBeInTheDocument();
    expect(screen.getByText(/Ship to: Bob, 2 Side St, City 999/)).toBeInTheDocument();
    expect(screen.getByText(/Order ORD-ABC placed!/)).toBeInTheDocument();
  });
});

describe('Wishlist', () => {
  it('shows an empty state', async () => {
    await renderApp('/wishlist');
    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument();
  });

  it('shows only saved products and drops one when un-hearted', async () => {
    fake.reset({ wishlist: [2, 3] });
    const { user } = await renderApp('/wishlist');
    expect(await screen.findByRole('heading', { name: 'Smart Watch' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yoga Mat' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Paperback Novel' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('heading', { name: 'Smart Watch' }).closest('.card')).getByRole('button', { name: /wishlist/i }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Smart Watch' })).not.toBeInTheDocument());
  });

  it('degrades to empty if products fail to load', async () => {
    fake.state.failures.push(/GET \/products$/);
    await renderApp('/wishlist');
    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument();
  });
});
