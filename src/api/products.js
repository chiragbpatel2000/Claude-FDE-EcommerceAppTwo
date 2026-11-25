import { request } from './client';

export const fetchProducts = () => request('/products');
// Resolves to null when the product doesn't exist.
export const fetchProduct = (id) =>
  request(`/products/${encodeURIComponent(id)}`).catch((e) => {
    if (e.message === 'Product not found' || e.message === 'Invalid id') return null;
    throw e;
  });
