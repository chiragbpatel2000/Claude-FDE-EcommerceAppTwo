import pg from 'pg';
import { products } from './seed.js';
import { schema } from './schema.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
  process.exit(1);
}

// Neon connection strings already include sslmode=require.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
// Neon suspends idle compute; a dropped idle client must not crash the process.
pool.on('error', (err) => console.error('Idle pg client error:', err.message));

export const query = (text, params) => pool.query(text, params);

export async function initDb() {
  await pool.query(schema);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM products');
  if (rows[0].n === 0) {
    for (const p of products) {
      await pool.query(
        `INSERT INTO products (id,name,category,price,emoji,color,rating,description,stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.category, p.price, p.emoji, p.color, p.rating, p.description, p.stock]
      );
    }
    console.log(`Seeded ${products.length} products`);
  }
}
