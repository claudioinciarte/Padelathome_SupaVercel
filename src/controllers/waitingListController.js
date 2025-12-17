const pool = require('../config/database');
const { io } = require('../../server'); // Import io instance

const joinWaitingList = async (req, res) => {
  const userId = req.user.id;
  const { courtId, slotStartTime, slotEndTime } = req.body;

  if (!courtId || !slotStartTime || !slotEndTime) {
    return res.status(400).json({ message: 'Se requiere courtId, slotStartTime y slotEndTime.' });
  }

  try {
    // Verificar si el slot ya está ocupado por una reserva confirmada
    const bookingResult = await pool.query(
      "SELECT id FROM bookings WHERE court_id = $1 AND start_time = $2 AND status = 'confirmed'",
      [courtId, slotStartTime]
    );
    if (bookingResult.rows.length === 0) {
      return res.status(400).json({ message: 'Este horario no está ocupado o ya no existe.' });
    }
    
    // Verificar si el usuario ya está en la lista de espera para este slot
    const existingEntry = await pool.query(
      "SELECT id FROM waiting_list_entries WHERE user_id = $1 AND court_id = $2 AND slot_start_time = $3 AND status = 'waiting'",
      [userId, courtId, slotStartTime]
    );
    if (existingEntry.rows.length > 0) {
      return res.status(400).json({ message: 'Ya estás en la lista de espera para este horario.' });
    }

    const { rows } = await pool.query(
      "INSERT INTO waiting_list_entries (court_id, user_id, slot_start_time, slot_end_time) VALUES ($1, $2, $3, $4) RETURNING *",
      [courtId, userId, slotStartTime, slotEndTime]
    );

    res.status(201).json({ message: 'Te has apuntado a la lista de espera correctamente.', entry: rows[0] });
    io.emit('waitlist:joined', { courtId: courtId, slotStartTime: slotStartTime, userId: userId }); // Emit WebSocket event

  } catch (error) {
    console.error('Error al unirse a la lista de espera:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const confirmBookingFromWaitlist = async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'Falta el token.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Buscar la entrada en la lista de espera con el token y que no haya expirado
    const entryResult = await pool.query(
      "SELECT * FROM waiting_list_entries WHERE confirmation_token = $1 AND status = 'notified' AND notification_expires_at > NOW()",
      [token]
    );

    if (entryResult.rows.length === 0) {
      throw new Error('El enlace de confirmación es inválido o ha expirado.');
    }
    const entry = entryResult.rows[0];

    // Verificar si el slot sigue libre (la reserva original pudo haber sido tomada por otro)
    const bookingResult = await pool.query(
      "SELECT id FROM bookings WHERE court_id = $1 AND start_time = $2 AND status = 'confirmed'",
      [entry.court_id, entry.slot_start_time]
    );
    if (bookingResult.rows.length > 0) {
      throw new Error('Lo sentimos, alguien ha reservado este slot justo antes que tú.');
    }

    // Crear la nueva reserva
    const newBookingResult = await client.query(
      "INSERT INTO bookings (court_id, user_id, start_time, end_time, status) VALUES ($1, $2, $3, $4, 'confirmed') RETURNING *",
      [entry.court_id, entry.user_id, entry.slot_start_time, entry.slot_end_time]
    );
    const newBooking = newBookingResult.rows[0];

    // Actualizar el estado de la entrada de la lista de espera
    await client.query(
      "UPDATE waiting_list_entries SET status = 'confirmed' WHERE id = $1",
      [entry.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: '¡Reserva confirmada exitosamente!' });
    io.emit('booking:created', newBooking); // Emit WebSocket event

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al confirmar desde lista de espera:", error);
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
};

const getUserWaitingListEntries = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      "SELECT court_id, slot_start_time, slot_end_time FROM waiting_list_entries WHERE user_id = $1 AND status = 'waiting'",
      [userId]
    );

    // Frontend expects duration in minutes. Calculate it.
    const entriesWithDuration = rows.map(entry => {
      const duration = (new Date(entry.slot_end_time).getTime() - new Date(entry.slot_start_time).getTime()) / 60000;
      return {
        court_id: entry.court_id,
        slot_start_time: entry.slot_start_time,
        duration: duration,
      };
    });

    res.status(200).json(entriesWithDuration);
  } catch (error) {
    console.error('Error fetching user waiting list entries:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const withdrawFromWaitingList = async (req, res) => {
  const userId = req.user.id;
  const { courtId, slotStartTime } = req.body;

  if (!courtId || !slotStartTime) {
    return res.status(400).json({ message: 'Se requiere courtId y slotStartTime.' });
  }

  try {
    const deleteResult = await pool.query(
      "DELETE FROM waiting_list_entries WHERE user_id = $1 AND court_id = $2 AND slot_start_time = $3 AND status = 'waiting'",
      [userId, courtId, slotStartTime]
    );

    if (deleteResult.rowCount === 0) {
      // This could happen if they were already removed or confirmed a booking. Not a critical error.
      return res.status(200).json({ message: 'No se encontró una entrada activa en la lista de espera para eliminar.' });
    }

    res.status(200).json({ message: 'Has sido retirado de la lista de espera.' });
    io.emit('waitlist:withdrawn', { courtId, slotStartTime, userId });

  } catch (error) {
    console.error('Error al retirarse de la lista de espera:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

module.exports = {
  joinWaitingList,
  confirmBookingFromWaitlist,
  getUserWaitingListEntries,
  withdrawFromWaitingList,
};