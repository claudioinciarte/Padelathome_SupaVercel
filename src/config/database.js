const { Pool } = require('pg');

// El pool lee la variable de entorno DATABASE_URL.
// Para Supabase se recomienda el "Transaction pooler" IPv4 (necesario en Vercel,
// ya que el host directo db.* solo resuelve IPv6):
//   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
// El transaction pooler multiplexa las conexiones; el session pooler (5432) solo
// admite 15 clientes simultáneos (EMAXCONNSESSION en picos de concurrencia).
//
// IMPORTANTE (serverless): cada instancia de función de Vercel crea su propio
// pool. NO usar max=1: el panel admin y el dashboard disparan muchas peticiones
// en paralelo y, con un único cliente, las consultas se encolan y acaban en
// "timeout exceeded when trying to connect" (de hecho, una transacción con
// BEGIN + db.query interno espera a un segundo cliente que nunca llega). El
// transaction pooler de Supabase multiplexa conexiones (25+ clientes OK), así
// que max=5 (o DB_POOL_MAX) da margen sin agotar el límite de 60 del pooler.
// Se mantienen los REINTENTOS automáticos con backoff para absorber picos.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.DB_POOL_MAX || '5', 10),
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
