require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = require('../config/database');
const sendEmail = require('../services/emailService');
const { renderTemplate } = require('../services/emailTemplateService');
const crypto = require('crypto');

async function processExpiredWaitlistEntries() {
  console.log(`[CRON JOB] - ${new Date().toISOString()} - Iniciando verificación de la lista de espera...`);
  const client = await pool.connect();

  try {
    // 1. Buscamos todas las entradas notificadas cuyo tiempo ha pasado
    const expiredEntriesResult = await client.query(
      "SELECT * FROM waiting_list_entries WHERE status = 'notified' AND notification_expires_at < NOW()"
    );

    if (expiredEntriesResult.rows.length === 0) {
      console.log('[CRON JOB] - No hay entradas expiradas que procesar.');
      return;
    }

    console.log(`[CRON JOB] - Se encontraron ${expiredEntriesResult.rows.length} entradas expiradas.`);

    for (const expiredEntry of expiredEntriesResult.rows) {
      await client.query('BEGIN');

      // 2a. Marcamos la entrada actual como 'expired'
      await client.query("UPDATE waiting_list_entries SET status = 'expired' WHERE id = $1", [expiredEntry.id]);

      // 2b. Buscamos a la siguiente persona en la cola para el mismo slot
      const nextInLineResult = await client.query(
        `SELECT wle.id, u.name as user_name, u.email as user_email, wle.slot_start_time
         FROM waiting_list_entries wle
         JOIN users u ON wle.user_id = u.id
         WHERE wle.court_id = $1 AND wle.slot_start_time = $2 AND wle.status = 'waiting'
         ORDER BY wle.requested_at ASC
         LIMIT 1`,
        [expiredEntry.court_id, expiredEntry.slot_start_time]
      );

      // 2c. Si hay alguien más en la lista...
      if (nextInLineResult.rows.length > 0) {
        const nextUser = nextInLineResult.rows[0];
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const expires_at = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

        await client.query(
          "UPDATE waiting_list_entries SET status = 'notified', confirmation_token = $1, notification_expires_at = $2, notification_sent_at = NOW() WHERE id = $3",
          [confirmationToken, expires_at, nextUser.id]
        );
        
        const confirmationUrl = `${process.env.APP_URL}/confirm-booking.html?token=${confirmationToken}`;
        const slotTime = 'el turno anterior ha expirado';
        const { subject, html } = await renderTemplate('waitlist.slot', {
          userName: nextUser.user_name,
          slotTime,
          confirmationUrl
        });
        await sendEmail({
            to: nextUser.user_email,
            subject,
            html
        });
        console.log(`[CRON JOB] - Turno expirado. Notificando al siguiente usuario: ${nextUser.user_id}`);
      }
      
      await client.query('COMMIT');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CRON JOB] - Error procesando la lista de espera:', error);
  } finally {
    client.release();
  }
}

processExpiredWaitlistEntries().then(() => {
  console.log('[CRON JOB] - Verificación completada.');
  pool.end();
});