const { Pool } = require('pg');

// El pool lee automáticamente las variables de entorno PG_...
// pero las definimos explícitamente para mayor claridad
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('Conexión exitosa a la base de datos PostgreSQL');
});

module.exports = pool;