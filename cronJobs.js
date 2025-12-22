const cron = require('node-cron');
const pool = require('./src/config/database');

/**
 * Función que busca reservas de partidas abiertas (open match) activas
 * que están a punto de comenzar (en menos de 2 horas) y que no han alcanzado
 * el número mínimo de participantes (por defecto 4).
 * Si se cumple la condición, elimina la reserva y sus participantes.
 */
async function limpiarPartidasIncompletas() {
    console.log('Ejecutando Cron Job: Limpieza de partidas incompletas...');
    let client;
    try {
        client = await pool.connect();

        // 1. Obtener reservas 'active' (confirmed), que sean open_match
        // y que empiecen en el futuro cercano (próximas 2 horas).
        // Usamos NOW() de Postgres para consistencia horaria.
        const queryBookings = `
            SELECT id, start_time, COALESCE(max_participants, 4) as target_players
            FROM bookings
            WHERE status = 'confirmed'
              AND is_open_match = TRUE
              AND start_time > NOW()
              AND start_time < NOW() + INTERVAL '2 hours'
        `;

        const resultBookings = await client.query(queryBookings);
        const bookings = resultBookings.rows;

        console.log(`Encontradas ${bookings.length} partidas abiertas próximas.`);

        for (const booking of bookings) {
            // 2. Contar participantes para esta reserva
            const queryCount = `SELECT COUNT(*) as count FROM match_participants WHERE booking_id = $1`;
            const resultCount = await client.query(queryCount, [booking.id]);
            const playerCount = parseInt(resultCount.rows[0].count, 10);

            // 3. Aplicar regla: si faltan menos de 2 horas (ya filtrado en SQL)
            // Y si tiene menos de X jugadores
            if (playerCount < booking.target_players) {
                console.log(`Eliminando reserva ID ${booking.id}: Tiene ${playerCount}/${booking.target_players} jugadores y comienza en ${booking.start_time}`);

                try {
                    await client.query('BEGIN');

                    // Eliminar primero participantes para evitar error de FK (si no hay CASCADE configurado)
                    await client.query('DELETE FROM match_participants WHERE booking_id = $1', [booking.id]);

                    // Eliminar la reserva
                    await client.query('DELETE FROM bookings WHERE id = $1', [booking.id]);

                    await client.query('COMMIT');
                    console.log(`Reserva ID ${booking.id} eliminada correctamente.`);
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
