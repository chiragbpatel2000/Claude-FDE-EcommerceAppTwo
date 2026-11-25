import { FREE_SHIPPING_OVER, money, shippingFor } from '../src/utils/money';

describe('money', () => {
  it.each([
    [0, '$0.00'],
    [5, '$5.00'],
    [89.9, '$89.90'],
    [11.999, '$12.00'],
    [1234.5, '$1234.50'],
  ])('formats %s as %s', (n, out) => expect(money(n)).toBe(out));
});

describe('shippingFor', () => {
  it('is free for an empty cart', () => expect(shippingFor(0)).toBe(0));
  it('charges $5.99 below the threshold', () => {
    expect(shippingFor(0.01)).toBe(5.99);
    expect(shippingFor(FREE_SHIPPING_OVER - 0.01)).toBe(5.99);
  });
  it('is free at and above the threshold', () => {
    expect(shippingFor(FREE_SHIPPING_OVER)).toBe(0);
    expect(shippingFor(500)).toBe(0);
  });
});
