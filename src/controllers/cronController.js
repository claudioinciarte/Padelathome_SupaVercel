// Controlador para los trabajos programados (cron jobs).
// Los despliegues serverless (Vercel) no pueden ejecutar node-cron, así que estas
// tareas se exponen como endpoints HTTP protegidos por CRON_SECRET y son llamadas
// por GitHub Actions (u otro programador externo).
const pool = require('../config/database');
const sendEmail = require('../services/emailService');
const { renderTemplate } = require('../services/emailTemplateService');
const crypto = require('crypto');

// --- Verificación del secreto compartido para los endpoints de cron ---
const requireCronSecret = (req, res) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'] || req.body?.cronSecret;
  if (!secret || provided !== secret) {
    res.status(401).json({ message: 'No autorizado. Falta o es inválido el CRON_SECRET.' });
    return false;
  }
  return true;
};

/**
 * Busca reservas de partidas abiertas (open match) activas que están a punto de
 * comenzar (en menos de X horas configuradas) y que no han alcanzado el número
 * mínimo de participantes. Las cancela y notifica por email a los apuntados.
 */
const cleanIncompleteOpenMatches = async () => {
  console.log('Ejecutando Cron Job: Limpieza de partidas incompletas...');
  const client = await pool.connect();
  try {
    // 0. Obtener configuración de horas desde instance_settings. Por defecto: 2 horas.
    const settingsResult = await client.query(
      "SELECT setting_value FROM instance_settings WHERE setting_key = 'open_match_auto_cancel_hours'"
    );
    let cancelHours = 2;
    if (settingsResult.rows.length > 0) {
      cancelHours = parseInt(settingsResult.rows[0].setting_value, 10);
      if (isNaN(cancelHours) || cancelHours < 1) cancelHours = 2;
    }

    console.log(`Configuración de cancelación automática: ${cancelHours} horas antes.`);

    // 1. Obtener reservas 'confirmed' que sean open_match y empiecen en el futuro cercano.
    const queryBookings = `
      SELECT id, start_time, COALESCE(max_participants, 4) as target_players
      FROM bookings
      WHERE status = 'confirmed'
        AND is_open_match = TRUE
        AND start_time > NOW()
        AND start_time < NOW() + INTERVAL '${cancelHours} hours'
    `;

    const resultBookings = await client.query(queryBookings);
    const bookings = resultBookings.rows;

    console.log(`Encontradas ${bookings.length} partidas abiertas próximas.`);

    for (const booking of bookings) {
      // 2. Contar participantes para esta reserva
      const queryCount = `SELECT COUNT(*) as count FROM match_participants WHERE booking_id = $1`;
      const resultCount = await client.query(queryCount, [booking.id]);
      const playerCount = parseInt(resultCount.rows[0].count, 10);

      // 3. Aplicar regla: si faltan menos de X horas y tiene menos del target de jugadores
      if (playerCount < booking.target_players) {
        console.log(`Eliminando reserva ID ${booking.id}: Tiene ${playerCount}/${booking.target_players} jugadores y comienza en ${booking.start_time}`);

        try {
          // Obtener emails de los participantes antes de eliminar
          const queryParticipants = `
            SELECT u.email, u.name
            FROM match_participants mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.booking_id = $1
          `;
          const participantsResult = await client.query(queryParticipants, [booking.id]);
          const participants = participantsResult.rows;

          await client.query('BEGIN');

          // Eliminar primero participantes para evitar error de FK (si no hay CASCADE configurado)
          await client.query('DELETE FROM match_participants WHERE booking_id = $1', [booking.id]);

          // Eliminar la reserva
          await client.query('DELETE FROM bookings WHERE id = $1', [booking.id]);

          await client.query('COMMIT');
          console.log(`Reserva ID ${booking.id} eliminada correctamente.`);

          // Enviar correos de notificación
          const formattedDate = new Date(booking.start_time).toLocaleString('es-ES', { timeZone: 'UTC' });

          for (const participant of participants) {
            const cancelReason = `El motivo es que no se alcanzó el número mínimo de jugadores requeridos (${booking.target_players}) para realizar el encuentro.`;
            const { subject, html } = await renderTemplate('match.cancel', {
              userName: participant.name,
              formattedDate,
              cancelReason
            });
            await sendEmail({
              to: participant.email,
              subject,
              html
            });
          }
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Error al eliminar reserva ID ${booking.id}:`, err);
        }
      } else {
        console.log(`Reserva ID ${booking.id} está completa (${playerCount}/${booking.target_players}). Se mantiene.`);
      }
    }

    return { processed: bookings.length };
  } catch (error) {
    console.error('Error en el Cron Job cleanIncompleteOpenMatches:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Procesa las entradas de lista de espera cuyo turno de confirmación (30 minutos)
 * ha expirado, y notifica al siguiente usuario de la cola.
 */
const processExpiredWaitlistEntries = async () => {
  console.log(`[CRON JOB] - ${new Date().toISOString()} - Iniciando verificación de la lista de espera...`);
  const client = await pool.connect();

  try {
    // 1. Buscamos todas las entradas notificadas cuyo tiempo ha pasado
    const expiredEntriesResult = await client.query(
      "SELECT * FROM waiting_list_entries WHERE status = 'notified' AND notification_expires_at < NOW()"
    );

    if (expiredEntriesResult.rows.length === 0) {
      console.log('[CRON JOB] - No hay entradas expiradas que procesar.');
      return { expired: 0 };
    }

    console.log(`[CRON JOB] - Se encontraron ${expiredEntriesResult.rows.length} entradas expiradas.`);

    for (const expiredEntry of expiredEntriesResult.rows) {
      await client.query('BEGIN');

      // 2a. Marcamos la entrada actual como 'expired'
      await client.query("UPDATE waiting_list_entries SET status = 'expired' WHERE id = $1", [expiredEntry.id]);

      // 2b. Buscamos a la siguiente persona en la cola para el mismo slot
      const nextInLineResult = await client.query(
        `SELECT wle.id, wle.user_id, u.name as user_name, u.email as user_email, wle.slot_start_time
         FROM waiting_list_entries wle
         JOIN users u ON wle.user_id = u.id
         WHERE wle.court_id = $1 AND wle.slot_start_time = $2 AND wle.status = 'waiting'
         ORDER BY wle.requested_at ASC
         LIMIT 1`,
        [expiredEntry.court_id, expiredEntry.slot_start_time]
      );

      // 2c. Si hay alguien más en la lista...
      let nextUser = null;
      let confirmationUrl = '';
      if (nextInLineResult.rows.length > 0) {
        nextUser = nextInLineResult.rows[0];
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const expires_at = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

        await client.query(
          "UPDATE waiting_list_entries SET status = 'notified', confirmation_token = $1, notification_expires_at = $2, notification_sent_at = NOW() WHERE id = $3",
          [confirmationToken, expires_at, nextUser.id]
        );

        const appUrl = process.env.APP_URL || '';
        confirmationUrl = `${appUrl}/confirm-booking.html?token=${confirmationToken}`;
      }

      await client.query('COMMIT');

      // Enviamos el correo después del COMMIT
      if (nextUser) {
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
    }

    return { expired: expiredEntriesResult.rows.length };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CRON JOB] - Error procesando la lista de espera:', error);
    throw error;
  } finally {
    client.release();
  }
};

// --- Handlers HTTP ---
const openMatchesCleanupHandler = async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const result = await cleanIncompleteOpenMatches();
    res.json({ message: 'Limpieza de partidas incompletas completada.', ...result });
  } catch (error) {
    res.status(500).json({ message: 'Error ejecutando la limpieza de partidas.' });
  }
};

const waitingListHandler = async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const result = await processExpiredWaitlistEntries();
    res.json({ message: 'Verificación de lista de espera completada.', ...result });
  } catch (error) {
    res.status(500).json({ message: 'Error ejecutando la verificación de lista de espera.' });
  }
};

module.exports = {
  cleanIncompleteOpenMatches,
  processExpiredWaitlistEntries,
  openMatchesCleanupHandler,
  waitingListHandler,
};
