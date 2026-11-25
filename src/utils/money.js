export const money = (n) => `$${n.toFixed(2)}`;

export const FREE_SHIPPING_OVER = 100;
export const shippingFor = (subtotal) =>
  subtotal === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : 5.99;
