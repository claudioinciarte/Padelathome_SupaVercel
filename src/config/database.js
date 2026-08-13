const { Pool } = require('pg');

// El pool lee la variable de entorno DATABASE_URL.
// Para Supabase se recomienda el "Session pooler" IPv4 (necesario en Vercel,
// ya que el host directo db.* solo resuelve IPv6):
//   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
//
// IMPORTANTE (serverless): el session pooler de Supabase limita a 15 clientes
// simultáneos (EMAXCONNSESSION). Cada instancia de función de Vercel crea su
// propio pool, así que usamos max=1, timeouts cortos y REINTENTOS automáticos
// con backoff para absorber los picos de concurrencia (p.ej. el panel admin
// dispara ~12 peticiones a la vez).
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

// --- Reintentos automáticos ante saturación del pooler de Supabase ---
const MAX_RETRIES = parseInt(process.env.DB_RETRIES || '4', 10);

const isPoolerSaturated = (err) =>
  err && typeof err.message === 'string' && /max clients reached|EMAXCONNSESSION/i.test(err.message);

const withRetry = (fn, retries = MAX_RETRIES) =>
  fn().catch((err) => {
    if (isPoolerSaturated(err) && retries > 0) {
      const delay = 100 * (MAX_RETRIES - retries + 1) + Math.floor(Math.random() * 250);
      return new Promise((resolve) => setTimeout(resolve, delay)).then(() => withRetry(fn, retries - 1));
    }
    throw err;
  });

// Envolvemos pool.query y pool.connect para que todos los controllers
// se beneficien del reintento sin cambios de código.
const originalQuery = pool.query.bind(pool);
pool.query = (...args) => withRetry(() => originalQuery(...args));

// OJO: pg-pool usa internamente connect en estilo callback (devuelve undefined).
// Solo aplicamos reintento cuando se llama en estilo promesa (los controllers).
const originalConnect = pool.connect.bind(pool);
pool.connect = (...args) => {
  const last = args[args.length - 1];
  if (typeof last === 'function') {
    return originalConnect(...args);
  }
  return withRetry(() => originalConnect(...args));
};

module.exports = pool;
