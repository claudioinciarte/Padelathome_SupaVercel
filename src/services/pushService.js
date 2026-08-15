// Servicio de notificaciones push (Web Push / VAPID).
// En serverless (Vercel) cada envío es una petición HTTP del servidor a los
// push services (FCM/Web Push), así que todo va con await antes de responder.
const webpush = require('web-push');
const pool = require('../config/database');

let initialized = false;

const initPush = () => {
  if (initialized) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@padelathome.local',
    publicKey,
    privateKey
  );
  initialized = true;
  return true;
};

// Envía una notificación push a los usuarios indicados (excluyendo a
// excludeUserId). Borra las suscripciones inválidas (404/410). Nunca lanza:
// los fallos se loguean y se devuelven en { sent, errors }.
const sendPushToUsers = async (userIds, payload, excludeUserId) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return { sent: 0, errors: 0 };
  if (!initPush()) return { sent: 0, errors: 0 };

  const ids = userIds.filter(id => String(id) !== String(excludeUserId));
  if (ids.length === 0) return { sent: 0, errors: 0 };

  try {
    const subsResult = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::bigint[])',
      [ids]
    );
    if (subsResult.rows.length === 0) return { sent: 0, errors: 0 };

    let sent = 0;
    let errors = 0;
    const toDelete = [];

    await Promise.all(subsResult.rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err) {
        errors++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          toDelete.push(sub.id); // El dispositivo ya no está suscrito
        } else {
          console.error('Error al enviar push:', err.statusCode, err.body || err.message);
        }
      }
    }));

    if (toDelete.length > 0) {
      await pool.query('DELETE FROM push_subscriptions WHERE id = ANY($1::bigint[])', [toDelete]);
      console.log(`Push: eliminadas ${toDelete.length} suscripciones inválidas.`);
    }

    return { sent, errors };
  } catch (error) {
    console.error('Error en sendPushToUsers:', error);
    return { sent: 0, errors: 1 };
  }
};

module.exports = { sendPushToUsers, initPush };
