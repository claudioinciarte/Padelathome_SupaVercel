// Fichero: src/jobs/checkOpenMatches.js
// Importamos dotenv para que este script independiente pueda leer el .env
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = require('../config/database');
const sendEmail = require('../services/emailService');
const { renderTemplate } = require('../services/emailTemplateService');

async function cancelIncompleteMatches() {
  console.log(`[CRON JOB - Partidas Abiertas] - ${new Date().toISOString()} - Verificando partidas incompletas...`);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscamos todas las partidas abiertas ('is_open_match' = true) que estén 'confirmed'
    //    y que vayan a empezar dentro del período de cancelación (ej. 6 horas)
    const bookingsToCancelResult = await client.query(
      `SELECT b.id, b.start_time, b.max_participants, b.auto_cancel_hours_before, array_agg(mp.user_id) as participant_ids
       FROM bookings b
       LEFT JOIN match_participants mp ON b.id = mp.booking_id
       WHERE b.is_open_match = TRUE
         AND b.status = 'confirmed'
         -- La hora de inicio está entre ahora y el límite de cancelación (ej. 6 horas desde ahora)
         AND b.start_time BETWEEN NOW() AND NOW() + (b.auto_cancel_hours_before * INTERVAL '1 hour')
       GROUP BY b.id
       -- Y filtramos solo las que no han alcanzado el máximo de participantes
       HAVING COUNT(mp.user_id) < b.max_participants`
    );

    if (bookingsToCancelResult.rows.length === 0) {
      console.log('[CRON JOB - Partidas Abiertas] - No hay partidas incompletas para cancelar.');
      await client.query('COMMIT'); // Hacemos commit igual para cerrar la transacción
      return;
    }

    console.log(`[CRON JOB - Partidas Abiertas] - Se encontraron ${bookingsToCancelResult.rows.length} partidas para cancelar.`);
    
    for (const match of bookingsToCancelResult.rows) {
      // 2. Cancelamos la reserva
      await client.query("UPDATE bookings SET status = 'cancelled_by_admin' WHERE id = $1", [match.id]);

      // 3. Obtenemos los emails de los participantes que sí se habían apuntado
      if (match.participant_ids && match.participant_ids[0] !== null) {
        const usersResult = await client.query("SELECT email, name FROM users WHERE id = ANY($1::bigint[])", [match.participant_ids]);
        
        // 4. Enviamos el correo de cancelación a todos los apuntados
        for (const user of usersResult.rows) {
          const formattedDate = new Date(match.start_time).toLocaleString('es-ES');
          const cancelReason = `La partida abierta ha sido cancelada automáticamente porque no se ha alcanzado el mínimo de ${match.max_participants} jugadores ${match.auto_cancel_hours_before} horas antes de su inicio. El slot de la pista ha sido liberado.`;
          const { subject, html } = await renderTemplate('match.cancel', {
            userName: user.name,
            formattedDate,
            cancelReason
          });
          await sendEmail({
            to: user.email,
            subject,
            html
          });
        }
        console.log(`[CRON JOB - Partidas Abiertas] - Partida ${match.id} cancelada. Notificando a ${usersResult.rows.length} participantes.`);
      }
    }

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CRON JOB - Partidas Abiertas] - Error cancelando partidas:', error);
  } finally {
    client.release();
  }
}

// Ejecutamos la función y cerramos el pool para que el script termine
cancelIncompleteMatches().then(() => {
  console.log('[CRON JOB - Partidas Abiertas] - Verificación de partidas completada.');
  pool.end();
});