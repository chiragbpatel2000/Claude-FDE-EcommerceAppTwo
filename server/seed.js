// Seed catalog, inserted into the database on first start when the products table is empty.
const p = (id, name, category, price, emoji, color, rating, description) => ({
  id, name, category, price, emoji, color, rating, description, stock: 5 + ((id * 7) % 20),
});

export const products = [
  p(1, 'Wireless Headphones', 'Electronics', 89.99, '🎧', '#dbeafe', 4.5, 'Over-ear Bluetooth headphones with active noise cancelling and 30-hour battery life.'),
  p(2, 'Smart Watch', 'Electronics', 149.0, '⌚', '#e0e7ff', 4.3, 'Track fitness, sleep and notifications with a bright always-on display.'),
  p(3, 'Mechanical Keyboard', 'Electronics', 74.5, '⌨️', '#fce7f3', 4.7, 'Hot-swappable tactile switches, RGB backlight and a compact 75% layout.'),
  p(4, 'Portable Speaker', 'Electronics', 45.0, '🔊', '#fef3c7', 4.2, 'Waterproof speaker with deep bass and 12 hours of playtime.'),
  p(5, 'Running Shoes', 'Fashion', 62.0, '👟', '#dcfce7', 4.4, 'Lightweight breathable shoes with responsive cushioning for daily runs.'),
  p(6, 'Denim Jacket', 'Fashion', 58.0, '🧥', '#cffafe', 4.1, 'Classic fit denim jacket in a durable mid-wash finish.'),
  p(7, 'Sunglasses', 'Fashion', 32.0, '🕶️', '#fee2e2', 4.0, 'UV400 polarized lenses in a timeless frame.'),
  p(8, 'Leather Backpack', 'Fashion', 96.0, '🎒', '#ffedd5', 4.6, 'Water-resistant backpack with a padded 15" laptop sleeve.'),
  p(9, 'Ceramic Mug Set', 'Home', 24.0, '☕', '#fef9c3', 4.5, 'Set of four hand-glazed 12oz mugs, microwave and dishwasher safe.'),
  p(10, 'Desk Lamp', 'Home', 38.0, '💡', '#f3e8ff', 4.3, 'Dimmable LED lamp with adjustable colour temperature and USB port.'),
  p(11, 'Indoor Plant', 'Home', 19.0, '🪴', '#d1fae5', 4.8, 'Low-maintenance potted plant that brightens up any room.'),
  p(12, 'Scented Candle', 'Home', 16.5, '🕯️', '#fde68a', 4.4, 'Soy wax candle with notes of vanilla and sandalwood. 40-hour burn time.'),
  p(13, 'Yoga Mat', 'Sports', 28.0, '🧘', '#bbf7d0', 4.5, 'Non-slip 6mm mat with carrying strap.'),
  p(14, 'Dumbbell Set', 'Sports', 85.0, '🏋️', '#e2e8f0', 4.6, 'Adjustable 2–20kg dumbbells that replace a full rack of weights.'),
  p(15, 'Water Bottle', 'Sports', 21.0, '🧴', '#bae6fd', 4.7, 'Insulated stainless steel bottle keeps drinks cold 24h or hot 12h.'),
  p(16, 'Paperback Novel', 'Books', 11.99, '📖', '#fecaca', 4.2, 'A gripping bestselling thriller you will not be able to put down.'),
];


