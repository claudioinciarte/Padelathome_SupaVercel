const { Pool } = require('pg');

// El pool lee la variable de entorno DATABASE_URL.
// Para Supabase se recomienda el "Session pooler" IPv4 (necesario en Vercel,
// ya que el host directo db.* solo resuelve IPv6):
//   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
//
// IMPORTANTE (serverless): el session pooler de Supabase limita a 15 clientes
// simultáneos (EMAXCONNSESSION). Cada instancia de función de Vercel crea su
// propio pool, así que usamos max=1 y timeouts cortos para no agotar el límite.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.DB_POOL_MAX || '1', 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '5000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '8000', 10),
});

pool.on('connect', () => {
  console.log('Conexión exitosa a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = pool;
