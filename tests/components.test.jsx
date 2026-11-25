import { screen, within } from '@testing-library/react';
import { cartRow, fake } from './helpers/fakeApi';
import { renderApp } from './helpers/render';

describe('Header', () => {
  it('shows nav links with no cart badge when the cart is empty', async () => {
    await renderApp();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /wishlist \(0\)/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Orders' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /cart/i }).textContent).not.toMatch(/\d/);
  });

  it('shows total item quantity and wishlist count', async () => {
    fake.reset({ cart: [cartRow(1, 2), cartRow(3, 1)], wishlist: [1, 2] });
    await renderApp();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /cart/i })).toHaveTextContent('3');
    expect(within(nav).getByRole('link', { name: /wishlist \(2\)/i })).toBeInTheDocument();
  });

  it('logo links home', async () => {
    await renderApp('/cart');
    expect(screen.getByRole('link', { name: /marketnest/i })).toHaveAttribute('href', '/');
  });
});

describe('ProductCard', () => {
  const card = (name) => screen.getByRole('heading', { name }).closest('.card');

  it('renders name, price, rating and category and links to the detail page', async () => {
    await renderApp();
    const c = card('Yoga Mat');
    expect(within(c).getByText('$28.00')).toBeInTheDocument();
    expect(within(c).getByText('★ 4.6')).toBeInTheDocument();
    expect(within(c).getByText('Sports')).toBeInTheDocument();
    expect(within(c).getAllByRole('link')[0]).toHaveAttribute('href', '/product/3');
  });

  it('adds to the cart and updates the header badge', async () => {
    const { user } = await renderApp();
    await user.click(within(card('Yoga Mat')).getByRole('button', { name: /add to cart/i }));
    await user.click(within(card('Yoga Mat')).getByRole('button', { name: /add to cart/i }));
    expect(await within(screen.getByRole('navigation')).findByText('2')).toBeInTheDocument();
    expect(fake.state.cart[0].qty).toBe(2);
  });

  it('toggles the wishlist heart', async () => {
    const { user } = await renderApp();
    const heart = () => within(card('Smart Watch')).getByRole('button', { name: /wishlist/i });
    expect(heart()).toHaveAccessibleName('Add to wishlist');
    await user.click(heart());
    expect(await screen.findByRole('link', { name: /wishlist \(1\)/i })).toBeInTheDocument();
    expect(heart()).toHaveAccessibleName('Remove from wishlist');
    expect(heart()).toHaveClass('on');
    await user.click(heart());
    expect(await screen.findByRole('link', { name: /wishlist \(0\)/i })).toBeInTheDocument();
  });
});
