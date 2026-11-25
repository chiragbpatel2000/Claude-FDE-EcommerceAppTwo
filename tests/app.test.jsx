import { screen, waitFor } from '@testing-library/react';
import { cartRow, fake } from './helpers/fakeApi';
import { renderApp } from './helpers/render';

describe('App shell and store', () => {
  it('renders the shop at /', async () => {
    await renderApp('/');
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows a loading state until the store has loaded', async () => {
    let release;
    fake.request.mockImplementation((path) =>
      path === '/cart' ? new Promise((r) => { release = () => r([]); }) : Promise.resolve([])
    );
    const pending = renderApp('/cart');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    release();
    await pending;
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('shows a 404 page for unknown routes', async () => {
    await renderApp('/does-not-exist');
    expect(screen.getByText('Page not found.')).toBeInTheDocument();
  });

  it('loads cart, wishlist and orders on startup', async () => {
    fake.reset({ cart: [cartRow(1, 2)], wishlist: [3] });
    await renderApp('/');
    expect(screen.getByRole('link', { name: /cart/i })).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: /wishlist \(1\)/i })).toBeInTheDocument();
  });

  it('shows an error banner if the initial load fails, and still renders the app', async () => {
    fake.state.failures.push(/GET \/cart$/);
    await renderApp('/');
    expect(screen.getByRole('alert')).toHaveTextContent('Server exploded');
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows a banner when a mutation fails and lets you dismiss it', async () => {
    const { user } = await renderApp('/');
    fake.state.failures.push(/POST \/cart\/items/);
    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears a previous error when the next action succeeds', async () => {
    const { user } = await renderApp('/');
    fake.state.failures.push(/POST \/cart\/items/);
    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    await screen.findByRole('alert');
    fake.state.failures.length = 0;
    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('full journey: browse, add, checkout, see the order', async () => {
    const { user } = await renderApp('/');
    await user.click(screen.getByRole('link', { name: /Yoga Mat/ }));
    await user.click(await screen.findByRole('button', { name: /add to cart/i }));
    await user.click(await screen.findByRole('link', { name: /cart/i }));
    await user.click(await screen.findByRole('link', { name: 'Checkout' }));
    await user.type(screen.getByLabelText(/full name/i), 'Zed');
    await user.type(screen.getByLabelText(/email/i), 'z@z.co');
    await user.type(screen.getByLabelText(/address/i), '9 Road');
    await user.type(screen.getByLabelText(/city/i), 'Metro');
    await user.type(screen.getByLabelText(/zip/i), '00001');
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByText(/order ORD-TEST1 placed/i)).toBeInTheDocument();
    expect(screen.getByText(/Yoga Mat × 1/)).toBeInTheDocument();
  });
});
