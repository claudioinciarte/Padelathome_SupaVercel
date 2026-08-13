// Carga las variables de entorno desde .env al principio de todo
require('dotenv').config();

// Forzar la zona horaria en entornos que no la configuran (Vercel corre en UTC
// y la variable TZ no se puede fijar con `vercel env add`; el calendario y los
// horarios de apertura dependen de la hora local de la comunidad).
if (!process.env.TZ) {
  process.env.TZ = 'Europe/Madrid';
}

// Imports de las librerías
const express = require('express');
const cors = require('cors');

// Imports de nuestros módulos de rutas
const authRoutes = require('./api/authRoutes');
const userRoutes = require('./api/userRoutes');
const scheduleRoutes = require('./api/scheduleRoutes');
const bookingRoutes = require('./api/bookingRoutes');
const courtRoutes = require('./api/courtRoutes');
const adminRoutes = require('./api/adminRoutes');
const waitingListRoutes = require('./api/waitingListRoutes');
const matchRoutes = require('./api/matchRoutes');
const cronRoutes = require('./api/cronRoutes');

// Creación de la aplicación Express (exportable, compatible con Vercel serverless)
const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Definición de Rutas de la API ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waiting-list', waitingListRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/cron', cronRoutes);

// Healthcheck para Vercel y monitoreo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
