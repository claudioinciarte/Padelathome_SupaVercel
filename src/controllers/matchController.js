const pool = require('../config/database');
const sendEmail = require('../services/emailService');
const realtime = require('../services/realtime');

const getOpenMatches = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        b.id,
        b.court_id,
        c.name as court_name,
        b.start_time,
        b.end_time,
        b.max_participants,
        COUNT(mp.user_id) as current_participants,
        b.user_id as organizer_id,
        u.name as organizer_name
      FROM bookings b
      JOIN courts c ON b.court_id = c.id
      LEFT JOIN match_participants mp ON b.id = mp.booking_id
      JOIN users u ON b.user_id = u.id
      WHERE b.is_open_match = TRUE
        AND b.status = 'confirmed'
        AND b.end_time > NOW()
      GROUP BY b.id, c.name, u.name
      ORDER BY b.start_time ASC;
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener partidas abiertas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const joinOpenMatch = async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.params;
  if (!bookingId || isNaN(parseInt(bookingId))) {
    return res.status(400).json({ message: 'El ID de la partida proporcionado no es válido.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloquear la fila de la reserva para evitar condiciones de carrera
    const bookingResult = await client.query("SELECT * FROM bookings WHERE id = $1 AND status = 'confirmed' FOR UPDATE", [bookingId]);
    if (bookingResult.rows.length === 0) throw new Error('Esta partida ya no existe o ha sido cancelada.');

    const booking = bookingResult.rows[0];
    if (!booking.is_open_match) throw new Error('Esta reserva no es una partida abierta.');
    if (booking.user_id === userId) throw new Error('No puedes unirte a tu propia partida, ya eres el organizador.');

    // Contar participantes actuales
    const participantsResult = await client.query("SELECT user_id FROM match_participants WHERE booking_id = $1", [bookingId]);
    if (participantsResult.rows.length >= booking.max_participants) throw new Error('Esta partida ya está completa.');

    // Verificar si el usuario ya está unido
    const isAlreadyJoined = participantsResult.rows.some(p => p.user_id == userId);
    if (isAlreadyJoined) throw new Error('Ya te has unido a esta partida.');

    // Añadir participante
    await client.query("INSERT INTO match_participants (booking_id, user_id) VALUES ($1, $2)", [bookingId, userId]);

    // Get updated participant count
    const updatedParticipantsResult = await client.query("SELECT COUNT(user_id) FROM match_participants WHERE booking_id = $1", [bookingId]);
    const currentParticipants = parseInt(updatedParticipantsResult.rows[0].count);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Te has unido a la partida con éxito.' });
    realtime.emit('match:updated', { bookingId: bookingId, currentParticipants: currentParticipants, maxParticipants: booking.max_participants }); // Emit WebSocket event
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al unirse a la partida:', error);
    res.status(400).json({ message: error.message || 'Error al procesar la solicitud.' });
  } finally {
    client.release();
  }
};

const leaveOpenMatch = async (req, res) => {
  const userId = req.user.id; // Usuario que abandona
  const { bookingId } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtenemos la reserva y la bloqueamos
    const bookingResult = await client.query(
      "SELECT * FROM bookings WHERE id = $1 AND status = 'confirmed' FOR UPDATE",
      [bookingId]
    );
    if (bookingResult.rows.length === 0) {
      throw new Error("La partida ya no existe o fue cancelada.");
    }
    const booking = bookingResult.rows[0];
    const isOwner = booking.user_id == userId; // ¿El que abandona es el dueño?

    // 2. Verificamos que el usuario está realmente en la partida y lo eliminamos
    // Esta eliminación se hace SIEMPRE, sea dueño o participante, porque el dueño también "abandona" su rol.
    // Si el dueño no está en match_participants, esta query no eliminará nada, lo cual es correcto.
    await client.query(
      "DELETE FROM match_participants WHERE booking_id = $1 AND user_id = $2",
      [bookingId, userId]
    );

    // --- LÓGICA DE REGLAS DE NEGOCIO ---
    const hoursRemaining = (new Date(booking.start_time).getTime() - new Date().getTime()) / 3600000;
    const autoCancelHoursBefore = booking.auto_cancel_hours_before || 6; // Default to 6 hours if not set

    // 3. REGLA: Cancelación a última hora (< 6h)
    // Si faltan 6 horas o menos, y alguien (CUALQUIERA) se va, la partida se cancela.
    let cancellationParticipants = [];
    const formattedDate = new Date(booking.start_time).toLocaleString('es-ES', { timeZone: 'UTC' });
    if (hoursRemaining <= autoCancelHoursBefore) {
      await client.query("UPDATE bookings SET status = 'cancelled_by_admin' WHERE id = $1", [bookingId]);
      console.log(`Partida ${bookingId} cancelada por abandono a última hora.`);

      try {
        const participantsQuery = `
          SELECT DISTINCT u.email, u.name
          FROM users u
          LEFT JOIN match_participants mp ON u.id = mp.user_id AND mp.booking_id = $1
          WHERE (mp.booking_id = $1 OR u.id = $2)
            AND u.id != $3
        `;
        const participantsResult = await client.query(participantsQuery, [bookingId, booking.user_id, userId]);
        cancellationParticipants = participantsResult.rows;
      } catch (emailError) {
        console.error(`Error al obtener correos de cancelación para la partida ${bookingId}:`, emailError);
      }
    }
    // 4. REGLA: El organizador abandona (y faltan MÁS de 6 horas)
    else if (isOwner) {
      // 4a. Buscamos al siguiente participante por orden de antigüedad
      const nextOrganizerResult = await client.query(
        "SELECT user_id FROM match_participants WHERE booking_id = $1 ORDER BY joined_at ASC LIMIT 1",
        [bookingId]
      );

      if (nextOrganizerResult.rows.length > 0) {
        // 4b. Si hay alguien, lo nombramos nuevo organizador
        const newOwnerId = nextOrganizerResult.rows[0].user_id;
        await client.query("UPDATE bookings SET user_id = $1 WHERE id = $2", [newOwnerId, bookingId]);
        console.log(`Partida ${bookingId}: El organizador ha cambiado a ${newOwnerId}.`);
      } else {
        // 4c. Si no queda nadie, la partida se cancela
        await client.query("UPDATE bookings SET status = 'cancelled_by_admin' WHERE id = $1", [bookingId]);
        console.log(`Partida ${bookingId} cancelada. El organizador era el último jugador.`);
      }
    }
    // 5. Si abandona un participante normal y faltan MÁS de 6 horas, no pasa nada
    // (Simplemente se libera un hueco).

    await client.query('COMMIT');

    // Enviamos los correos de cancelación después del COMMIT
    if (cancellationParticipants.length > 0) {
      try {
        for (const participant of cancellationParticipants) {
          await sendEmail({
            to: participant.email,
            subject: 'Cancelación de Partida Abierta - Padel@Home',
            html: `
              <h3>Hola ${participant.name},</h3>
              <p>Te informamos que la partida abierta programada para el <strong>${formattedDate}</strong> ha sido cancelada.</p>
              <p>El motivo es que un jugador ha abandonado la partida quedando menos de ${autoCancelHoursBefore} horas para el inicio, por lo que el sistema la ha cancelado automáticamente.</p>
              <p>Disculpa las molestias.</p>
              <p>Atentamente,<br>El equipo de Padel@Home</p>
            `
          });
        }
        console.log(`Notificaciones de cancelación enviadas a ${cancellationParticipants.length} participantes (partida ${bookingId}).`);
      } catch (emailError) {
        console.error(`Error al enviar correos de cancelación para la partida ${bookingId}:`, emailError);
      }
    }

    res.json({ message: 'Has abandonado la partida correctamente.' });

    // Get updated participant count after leaving
    const updatedParticipantsResult = await client.query("SELECT COUNT(user_id) FROM match_participants WHERE booking_id = $1", [bookingId]);
    const currentParticipants = parseInt(updatedParticipantsResult.rows[0].count);

    realtime.emit('match:updated', { bookingId: bookingId, currentParticipants: currentParticipants, maxParticipants: booking.max_participants });

    // If the match was cancelled, also emit a booking:cancelled event
    if (booking.status === 'cancelled_by_admin') { // Check the status AFTER the update
        realtime.emit('booking:cancelled', { bookingId: bookingId, courtId: booking.court_id, startTime: booking.start_time });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al abandonar la partida:', error);
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
};

const getMatchParticipants = async (req, res) => {
  const { bookingId } = req.params;

  try {
    // Obtenemos el ID del organizador primero
    const bookingResult = await pool.query("SELECT user_id FROM bookings WHERE id = $1", [bookingId]);
    if (bookingResult.rows.length === 0) {
      throw new Error("Partida no encontrada.");
    }
    const ownerId = bookingResult.rows[0].user_id;

    // Buscamos a todos los participantes y sus nombres
    const participantsResult = await pool.query(
      `SELECT u.id, u.name
       FROM match_participants mp
       JOIN users u ON mp.user_id = u.id
       WHERE mp.booking_id = $1
       ORDER BY mp.joined_at ASC`,
      [bookingId]
    );

    // Añadimos al organizador si no está ya en la lista de participantes (puede que no esté en match_participants)
    const participants = participantsResult.rows;
    const isOrganizerInParticipants = participants.some(p => p.id === ownerId);
    if (!isOrganizerInParticipants) {
      const organizerResult = await pool.query("SELECT id, name FROM users WHERE id = $1", [ownerId]);
      if (organizerResult.rows.length > 0) {
        participants.unshift(organizerResult.rows[0]); // Añadir al principio
      }
    }

    res.json({ participants: participants });

  } catch (error) {
    console.error('Error al obtener participantes de la partida:', error);
    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
};

const getMatchDetails = async (req, res) => {
    const { bookingId } = req.params;

    try {
        // 1. Obtener información de la reserva y de la pista
        const bookingQuery = await pool.query(
            `SELECT b.*, c.name as court_name
             FROM bookings b
             JOIN courts c ON b.court_id = c.id
             WHERE b.id = $1`,
            [bookingId]
        );

        if (bookingQuery.rows.length === 0) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        const match = bookingQuery.rows[0];

        // 2. Obtener la lista de jugadores (Line-up)
        // Eliminado u.floor, u.door ya que no existen en este schema
        const playersQuery = await pool.query(
            `SELECT u.id, u.name, u.role
             FROM match_participants mp
             JOIN users u ON mp.user_id = u.id
             WHERE mp.booking_id = $1
             ORDER BY mp.joined_at ASC`,
            [bookingId]
        );

        // 3. Obtener el histórico de mensajes
        const messagesQuery = await pool.query(
            `SELECT m.*, u.name as user_name
             FROM match_messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.booking_id = $1
             ORDER BY m.created_at ASC`,
            [bookingId]
        );

        res.json({
            matchInfo: match,
            players: playersQuery.rows,
            messages: messagesQuery.rows
        });

    } catch (error) {
        console.error('Error al obtener detalles de la partida:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const sendMatchMessage = async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.params;
  const { message } = req.body;

  if (!bookingId || isNaN(parseInt(bookingId))) {
    return res.status(400).json({ message: 'El ID de la partida proporcionado no es válido.' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ message: 'El mensaje no puede estar vacío.' });
  }

  try {
    // Verificar que la partida existe y que el usuario participa en ella
    const bookingResult = await pool.query(
      "SELECT id FROM bookings WHERE id = $1 AND status = 'confirmed'",
      [bookingId]
    );
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Partida no encontrada.' });
    }

    const participantResult = await pool.query(
      "SELECT id FROM match_participants WHERE booking_id = $1 AND user_id = $2",
      [bookingId, userId]
    );
    const isOrganizer = await pool.query(
      "SELECT id FROM bookings WHERE id = $1 AND user_id = $2",
      [bookingId, userId]
    );
    if (participantResult.rows.length === 0 && isOrganizer.rows.length === 0) {
      return res.status(403).json({ message: 'No participas en esta partida.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO match_messages (booking_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, booking_id, user_id, message, created_at`,
      [bookingId, userId, message.trim()]
    );

    const savedMessage = rows[0];
    const userResult = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
    savedMessage.user_name = userResult.rows[0] ? userResult.rows[0].name : 'Usuario';

    realtime.emitToMatch(bookingId, 'receiveMessage', savedMessage);

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error al enviar mensaje de partida:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

module.exports = {
  getOpenMatches,
  joinOpenMatch,
  leaveOpenMatch,
  getMatchParticipants,
  getMatchDetails,
  sendMatchMessage,
};