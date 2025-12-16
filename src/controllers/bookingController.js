const db = require('../config/database');
const { addMinutes } = require('date-fns');
const sendEmail = require('../services/emailService');
const ics = require('ics');
const crypto = require('crypto'); // Necesario para la lista de espera
const { io } = require('../../server'); // Import io instance

/**
 * @description Crea una nueva reserva (privada o partida abierta)
 */
const createBooking = async (req, res) => {
  const userId = req.user.id;
  const { courtId, startTime, durationMinutes, isOpenMatch, maxParticipants } = req.body;
  if (!courtId || !startTime || !durationMinutes) {
    return res.status(400).json({ message: 'Se requiere courtId, startTime y durationMinutes.' });
  }
  const bookingStartTime = new Date(startTime);
  if (bookingStartTime < new Date()) {
    return res.status(400).json({ message: 'No se puede reservar en un horario pasado.' });
  }
  const bookingEndTime = addMinutes(bookingStartTime, durationMinutes);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // --- NEW LOGIC START ---
    // 0. Consultar instance_settings para límites de partidas abiertas
    const settingsResult = await client.query(
      "SELECT setting_key, setting_value FROM instance_settings WHERE setting_key IN ('limit_open_matches_enabled', 'max_open_matches_per_user')"
    );

    const settings = settingsResult.rows.reduce((acc, s) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const limitOpenMatchesEnabled = settings.limit_open_matches_enabled === 'true';
    const maxOpenMatchesPerUser = parseInt(settings.max_open_matches_per_user || '0', 10);

    if (isOpenMatch && limitOpenMatchesEnabled) {
      const userOpenMatchesResult = await client.query(
        `SELECT COUNT(*) as count FROM bookings 
         WHERE user_id = $1 
         AND is_open_match = TRUE 
         AND status = 'confirmed' 
         AND end_time > NOW()`,
        [userId]
      );
      const currentOpenMatchesCount = parseInt(userOpenMatchesResult.rows[0].count, 10);

      if (currentOpenMatchesCount >= maxOpenMatchesPerUser) {
        throw new Error(`Ya has alcanzado el límite de ${maxOpenMatchesPerUser} partidas abiertas activas.`);
      }
    }
    // --- NEW LOGIC END ---

    // Regla 1: ¿El usuario ya tiene una reserva activa?
    const activeBookingResult = await client.query("SELECT id FROM bookings WHERE user_id = $1 AND status = 'confirmed' AND end_time > (NOW() AT TIME ZONE 'UTC')", [userId]);
    if (activeBookingResult.rows.length > 0 && !isOpenMatch) {
      throw new Error('Ya tienes una reserva personal activa.');
    }

    // Regla 2: ¿El slot sigue disponible?
    const [bookingsResult, blockedResult] = await Promise.all([
        client.query("SELECT start_time, end_time FROM bookings WHERE court_id = $1 AND status = 'confirmed' AND start_time < $2 AND end_time > $3", [courtId, bookingEndTime, bookingStartTime]),
        db.query("SELECT start_time, end_time FROM blocked_periods WHERE court_id = $1 AND start_time < $2 AND end_time > $3", [courtId, bookingEndTime, bookingStartTime])
    ]);

    if (bookingsResult.rows.length > 0 || blockedResult.rows.length > 0) {
        throw new Error('El horario seleccionado ya no está disponible.');
    }

    // 3. Insertamos la nueva reserva
    const newBookingResult = await client.query(
      "INSERT INTO bookings (court_id, user_id, start_time, end_time, is_open_match, max_participants, auto_cancel_hours_before) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [courtId, userId, bookingStartTime, bookingEndTime, !!isOpenMatch, isOpenMatch ? maxParticipants : null, isOpenMatch ? 6 : null]
    );
    const newBooking = newBookingResult.rows[0];

    // 4. Si es partida abierta, añadimos al creador como participante
    if (newBooking.is_open_match) {
      await client.query("INSERT INTO match_participants (booking_id, user_id) VALUES ($1, $2)", [newBooking.id, userId]);
    }

    // 5. Obtenemos los datos para el email DENTRO de la transacción
    const userResult = await client.query("SELECT name, email FROM users WHERE id = $1", [userId]);
    const courtResult = await db.query("SELECT name FROM courts WHERE id = $1", [courtId]);
    
    await client.query('COMMIT');

    // 6. Enviamos el correo de confirmación (con .ics)
    const user = userResult.rows[0];
    const courtName = courtResult.rows[0].name;

    const event = {
      title: 'Reserva de Pista de Pádel',
      description: `Pista: ${courtName}\nReservado por: ${user.name}\n\nNos veremos en la pista, ¡no olvides dar lo mejor!`, // Corrected newline escaping
      start: [bookingStartTime.getFullYear(), bookingStartTime.getMonth() + 1, bookingStartTime.getDate(), bookingStartTime.getHours(), bookingStartTime.getMinutes()],
      end: [bookingEndTime.getFullYear(), bookingEndTime.getMonth() + 1, bookingEndTime.getDate(), bookingEndTime.getHours(), bookingEndTime.getMinutes()],
      status: 'CONFIRMED',
      organizer: { name: 'Padel@Home Admin', email: process.env.SMTP_USER },
      attendees: [{ name: user.name, email: user.email, rsvp: true, role: 'REQ-PARTICIPANT' }]
    };
    
    const { error, value } = ics.createEvent(event);
    if (!error) {
        sendEmail({
            to: user.email,
            subject: `Confirmación de Reserva en Padel@Home para el ${bookingStartTime.toLocaleDateString('es-ES')}`,
            html: `<h3>¡Hola, ${user.name}!</h3><p>Tu reserva ha sido confirmada. Adjuntamos un evento de calendario.</p>`,
            attachments: [{ filename: 'invitacion.ics', content: value, contentType: 'text/calendar' }]
        });
    }

    res.status(201).json(newBooking);
    io.emit('booking:created', newBooking); // Emit WebSocket event

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear la reserva:', error);
    res.status(400).json({ message: error.message || 'Error al procesar la reserva.' });
  } finally {
    client.release();
  }
};

/**
 * @description Obtiene TODAS las reservas activas del usuario (propias o como participante)
 */
const getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        b.id,
        b.court_id,
        b.user_id,
        b.start_time,
        b.end_time,
        b.status,
        b.is_open_match,
        c.name as court_name,
        CASE
          WHEN b.user_id = $1 THEN 'owner'
          ELSE 'participant'
        END as participation_type
      FROM bookings b
      JOIN courts c ON b.court_id = c.id
      LEFT JOIN match_participants mp ON b.id = mp.booking_id
      WHERE 
        (b.user_id = $1 OR mp.user_id = $1)
        AND b.status = 'confirmed' 
        AND b.end_time > (NOW() AT TIME ZONE 'UTC')
      GROUP BY b.id, c.name
      ORDER BY b.start_time ASC;
    `;
    
    const result = await db.query(query, [userId]);
    
    res.json(result.rows);

  } catch (error) {
    console.error('Error al obtener mis reservas:', error);
    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
  }
};

/**
 * @description Cancela una reserva del usuario logueado y activa la lista de espera
 */
const cancelMyBooking = async (req, res) => {
  const client = await db.connect();
  try {
    const userId = req.user.id; // El ID del usuario que está cancelando
    const { bookingId } = req.params; // El ID de la reserva a cancelar
    
    await client.query('BEGIN');

    // 1. Verificamos que el usuario es el DUEÑO y cancelamos la reserva
    const result = await client.query(
      "UPDATE bookings SET status = 'cancelled_by_user' WHERE id = $1 AND user_id = $2 AND status = 'confirmed' RETURNING *",
      [bookingId, userId]
    );

    // Si no se actualizó ninguna fila, es porque no es el dueño o la reserva no existe
    if (result.rowCount === 0) {
      throw new Error('No se encontró una reserva activa para cancelar o no tienes permiso para hacerlo.');
    }

    const cancelledBooking = result.rows[0];

    // --- LÓGICA DE LISTA DE ESPERA (se activa al cancelar) ---
    // 2. Buscamos al primer usuario en la lista de espera para este slot
    const waitingListResult = await client.query(
      `SELECT wle.id, wle.user_id, u.name as user_name, u.email as user_email, wle.slot_start_time
       FROM waiting_list_entries wle
       JOIN users u ON wle.user_id = u.id
       WHERE wle.court_id = $1 AND wle.slot_start_time = $2 AND wle.status = 'waiting'
       ORDER BY wle.requested_at ASC
       LIMIT 1`,
      [cancelledBooking.court_id, cancelledBooking.start_time]
    );

    // 3. Si encontramos a alguien...
    if (waitingListResult.rows.length > 0) {
      const luckyUser = waitingListResult.rows[0];
      
      const confirmationToken = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

      // 4. Actualizamos su estado a 'notified' y guardamos el token
      await client.query(
        "UPDATE waiting_list_entries SET status = 'notified', confirmation_token = $1, notification_expires_at = $2, notification_sent_at = NOW() WHERE id = $3",
        [confirmationToken, expires_at, luckyUser.id]
      );

      // 5. Le enviamos el correo de notificación
      const confirmationUrl = `${process.env.APP_URL}/confirm-booking.html?token=${confirmationToken}`;
      sendEmail({
        to: luckyUser.user_email,
        subject: '¡Un hueco se ha liberado en Padel@Home!',
        html: `<h3>¡Hola, ${luckyUser.user_name}!</h3><p>Se ha liberado el horario por el que estabas esperando (${new Date(luckyUser.slot_start_time).toLocaleString('es-ES')}).</p><p>Tienes <strong>30 minutos</strong> para confirmar la reserva haciendo clic en el siguiente enlace. Después, tu turno expirará.</p><a href="${confirmationUrl}">Confirmar mi Reserva</a>`
      });
      console.log(`Notificación de lista de espera enviada al usuario ${luckyUser.user_id}`);
      io.emit('waitlist:notificationSent', { userId: luckyUser.user_id, slotStartTime: luckyUser.slot_start_time }); // Emit WebSocket event
    }
    // --- FIN DE LÓGICA DE LISTA DE ESPERA ---

    await client.query('COMMIT');
    res.json({ message: 'Reserva cancelada exitosamente.' });
    io.emit('booking:cancelled', { bookingId: bookingId, courtId: cancelledBooking.court_id, startTime: cancelledBooking.start_time });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar la reserva:', error);
    res.status(400).json({ message: error.message || 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// Exportamos todas las funciones del controlador
module.exports = {
  createBooking,
  getMyBookings,
  cancelMyBooking,
};
