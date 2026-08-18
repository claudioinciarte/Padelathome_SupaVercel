const pool = require('../config/database');

// Guarda (o actualiza) la suscripción push del usuario logueado.
const subscribe = async (req, res) => {
  const userId = req.user.id;
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ message: 'Suscripción incompleta (endpoint, p256dh y auth requeridos).' });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = NOW()`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ message: 'Suscripción guardada correctamente.' });
  } catch (error) {
    console.error('Error guardando suscripción push:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// Elimina la suscripción push del usuario.
const unsubscribe = async (req, res) => {
  const userId = req.user.id;
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ message: 'Falta el endpoint de la suscripción.' });
  }
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint]);
    res.json({ message: 'Suscripción eliminada correctamente.' });
  } catch (error) {
    console.error('Error eliminando suscripción push:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// Clave pública VAPID para que el navegador pueda suscribirse (no es secreta).
const getConfig = async (req, res) => {
  res.json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null });
};

module.exports = { subscribe, unsubscribe, getConfig };
