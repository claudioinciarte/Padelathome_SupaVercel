const cron = require('node-cron');
const pool = require('./src/config/database');
const sendEmail = require('./src/services/emailService');

/**
 * Función que busca reservas de partidas abiertas (open match) activas
 * que están a punto de comenzar (en menos de X horas) y que no han alcanzado
 * el número mínimo de participantes (por defecto 4).
 * Si se cumple la condición, elimina la reserva y sus participantes.
 */
async function limpiarPartidasIncompletas() {
    console.log('Ejecutando Cron Job: Limpieza de partidas incompletas...');
    let client;
    try {
        client = await pool.connect();

        // 0. Obtener configuración de horas desde instance_settings
        // Por defecto: 2 horas
        const settingsResult = await client.query(
            "SELECT setting_value FROM instance_settings WHERE setting_key = 'open_match_auto_cancel_hours'"
        );
        let cancelHours = 2;
        if (settingsResult.rows.length > 0) {
            cancelHours = parseInt(settingsResult.rows[0].setting_value, 10);
            if (isNaN(cancelHours) || cancelHours < 1) cancelHours = 2;
        }

        console.log(`Configuración de cancelación automática: ${cancelHours} horas antes.`);

        // 1. Obtener reservas 'confirmed', que sean open_match
        // y que empiecen en el futuro cercano (próximas X horas).
        // Construimos el intervalo dinámicamente.
        // Usamos NOW() de Postgres para consistencia horaria.
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

            // 3. Aplicar regla: si faltan menos de X horas (ya filtrado en SQL)
            // Y si tiene menos de target_players jugadores
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
                        sendEmail({
                            to: participant.email,
                            subject: 'Cancelación de Partida Abierta - Padel@Home',
                            html: `
                                <h3>Hola ${participant.name},</h3>
                                <p>Te informamos que la partida abierta programada para el <strong>${formattedDate}</strong> ha sido cancelada.</p>
                                <p>El motivo es que no se alcanzó el número mínimo de jugadores requeridos (${booking.target_players}) para realizar el encuentro.</p>
                                <p>Disculpa las molestias y esperamos verte pronto en otra partida.</p>
                                <p>Atentamente,<br>El equipo de Padel@Home</p>
                            `
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

    } catch (error) {
        console.error('Error en el Cron Job limpiarPartidasIncompletas:', error);
    } finally {
        if (client) {
            client.release();
        }
    }
}

/**
 * Inicializa los cron jobs del sistema.
 */
function initCronJobs() {
    // Programar la ejecución cada 30 minutos
    cron.schedule('*/30 * * * *', () => {
        limpiarPartidasIncompletas();
    });
    console.log('Cron Jobs inicializados: limpiarPartidasIncompletas programado cada 30 minutos.');
}

module.exports = {
    initCronJobs
};
