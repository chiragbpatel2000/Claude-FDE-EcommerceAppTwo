export const schema = `
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  emoji       TEXT NOT NULL,
  color       TEXT NOT NULL,
  rating      NUMERIC(2,1) NOT NULL,
  description TEXT NOT NULL,
  stock       INTEGER NOT NULL CHECK (stock >= 0)
);

-- client_id is an anonymous browser id for now; swap for a user id when auth is added.
CREATE TABLE IF NOT EXISTS cart_items (
  client_id  TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  client_id  TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  PRIMARY KEY (client_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL,
  total      NUMERIC(10,2) NOT NULL,
  shipping   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_client_idx ON orders (client_id, created_at DESC);

-- name/emoji/price are snapshots so past orders don't change when the catalog does.
CREATE TABLE IF NOT EXISTS order_items (
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  price      NUMERIC(10,2) NOT NULL,
  qty        INTEGER NOT NULL
);
`;
