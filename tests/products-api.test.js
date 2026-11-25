import { fake } from './helpers/fakeApi';
import { fetchProduct, fetchProducts } from '../src/api/products';

describe('products api', () => {
  it('fetchProducts returns the list', async () => {
    const list = await fetchProducts();
    expect(list).toHaveLength(4);
    expect(fake.request).toHaveBeenCalledWith('/products');
  });

  it('fetchProduct returns one product', async () => {
    expect((await fetchProduct(3)).name).toBe('Yoga Mat');
  });

  it('fetchProduct resolves null for unknown or malformed ids', async () => {
    expect(await fetchProduct(999)).toBeNull();
    expect(await fetchProduct('abc')).toBeNull();
  });

  it('fetchProduct url-encodes the id', async () => {
    await fetchProduct('a/b');
    expect(fake.request).toHaveBeenCalledWith('/products/a%2Fb');
  });

  it('fetchProduct rethrows unexpected errors', async () => {
    fake.state.failures.push(/GET \/products\/1/);
    await expect(fetchProduct(1)).rejects.toThrow('Server exploded');
  });
});
