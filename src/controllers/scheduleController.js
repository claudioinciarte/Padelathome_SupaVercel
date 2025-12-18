const pool = require('../config/database');
// AÑADIMOS 'format' A LOS IMPORTS
const { startOfWeek, endOfWeek, startOfDay, endOfDay, eachDayOfInterval, parseISO, format } = require('date-fns');

// --- Función auxiliar ---
function isSlotAvailable(start, end, bookings, blocked) {
    for (const booking of bookings) {
        if (start < new Date(booking.end_time) && end > new Date(booking.start_time)) return false;
    }
    for (const block of blocked) {
        if (start < new Date(block.end_time) && end > new Date(block.start_time)) return false;
    }
    return true;
}

// --- getAvailability (Sin cambios importantes, pero actualizado por coherencia) ---
const getAvailability = async (req, res) => {
    // ... (puedes mantener tu código actual o copiar este bloque si prefieres)
    // Por brevedad, me centro en getWeekSchedule que es el que falla
    const { courtId, date } = req.query;
    if (!courtId || !date) return res.status(400).json({ message: 'Se requiere courtId y date.' });
    try {
        const targetDate = parseISO(date);
        const startOfTargetDate = startOfDay(targetDate);
        const endOfTargetDate = endOfDay(targetDate);
        // ... (consultas igual que antes) ...
        const [bookingsResult, blockedResult, settingsResult] = await Promise.all([
             pool.query("SELECT start_time, end_time FROM bookings WHERE court_id = $1 AND status = 'confirmed' AND start_time >= $2 AND start_time <= $3", [courtId, startOfTargetDate, endOfTargetDate]),
             pool.query("SELECT start_time, end_time, reason FROM blocked_periods WHERE court_id = $1 AND start_time >= $2 AND start_time <= $3", [courtId, startOfTargetDate, endOfTargetDate]),
             pool.query("SELECT setting_value FROM instance_settings WHERE setting_key IN ('operating_open_time', 'operating_close_time')")
        ]);
        // ... (procesamiento igual que antes) ...
        const bookings = bookingsResult.rows;
        const blockedPeriods = blockedResult.rows;
        const openTime = settingsResult.rows.find(s => s.setting_key === 'operating_open_time')?.setting_value || '08:00';
        const closeTime = settingsResult.rows.find(s => s.setting_key === 'operating_close_time')?.setting_value || '22:00';
        const availableSlots = [];
        const [openHour, openMinute] = openTime.split(':');
        const [closeHour, closeMinute] = closeTime.split(':');
        const dayStartTime = new Date(targetDate.setHours(openHour, openMinute, 0, 0));
        const dayEndTime = new Date(targetDate.setHours(closeHour, closeMinute, 0, 0));

        for (let i = dayStartTime; i < dayEndTime; i.setMinutes(i.getMinutes() + 30)) {
             // ... lógica de slots ...
             const potentialStartTime = new Date(i);
             const availableDurations = [];
             const endTime60 = new Date(potentialStartTime.getTime() + 60 * 60000);
             if (isSlotAvailable(potentialStartTime, endTime60, bookings, blockedPeriods) && endTime60 <= dayEndTime) availableDurations.push(60);
             const endTime90 = new Date(potentialStartTime.getTime() + 90 * 60000);
             if (isSlotAvailable(potentialStartTime, endTime90, bookings, blockedPeriods) && endTime90 <= dayEndTime) availableDurations.push(90);
             if (availableDurations.length > 0) availableSlots.push({ startTime: potentialStartTime.toISOString(), availableDurations });
        }
        res.json({ availability: availableSlots, blocked: blockedPeriods });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno.' });
    }
};

// --- CONTROLADOR CORREGIDO PARA LA SEMANA ---
const getWeekSchedule = async (req, res) => {
  const { courtId, date } = req.query;
  const userId = req.user.id; // <-- OBTENEMOS EL USER ID

  if (!courtId || !date) {
    return res.status(400).json({ message: 'Se requiere courtId y date.' });
  }
  try {
    const targetDate = parseISO(date);
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

    const bookingsResult = await pool.query("SELECT id, user_id, start_time, end_time, is_open_match, max_participants FROM bookings WHERE court_id = $1 AND status = 'confirmed' AND start_time >= $2 AND end_time <= $3", [courtId, weekStart, weekEnd]);
    const bookingIds = bookingsResult.rows.map(b => b.id);

    // OBTENEMOS LAS PARTIDAS EN LAS QUE PARTICIPA EL USUARIO
    const myParticipantBookingsResult = await pool.query(
        `SELECT booking_id FROM match_participants WHERE user_id = $1 AND booking_id = ANY($2::bigint[])`, [userId, bookingIds]
    );
    const myParticipantBookingIds = myParticipantBookingsResult.rows.map(r => r.booking_id);

    const [blockedResult, participantsResult, settingsResult, waitlistResult] = await Promise.all([
      pool.query("SELECT start_time, end_time, reason FROM blocked_periods WHERE court_id = $1 AND start_time >= $2 AND end_time <= $3", [courtId, weekStart, weekEnd]),
      pool.query("SELECT booking_id, COUNT(user_id) as participant_count FROM match_participants WHERE booking_id = ANY($1::bigint[]) GROUP BY booking_id", [bookingIds]),
      pool.query("SELECT setting_key, setting_value FROM instance_settings WHERE setting_key IN ('operating_open_time', 'operating_close_time')"),
      pool.query("SELECT slot_start_time, COUNT(user_id) as count FROM waiting_list_entries WHERE court_id = $1 AND slot_start_time >= $2 AND slot_start_time <= $3 AND status = 'waiting' GROUP BY slot_start_time", [courtId, weekStart, weekEnd])
    ]);
    
    const participantCounts = participantsResult.rows.reduce((acc, row) => { acc[row.booking_id] = parseInt(row.participant_count, 10); return acc; }, {});
    const waitlistCounts = waitlistResult.rows.reduce((acc, row) => { acc[new Date(row.slot_start_time).toISOString()] = parseInt(row.count, 10); return acc; }, {});

    const openTime = settingsResult.rows.find(s => s.setting_key === 'operating_open_time')?.setting_value || '08:00';
    const closeTime = settingsResult.rows.find(s => s.setting_key === 'operating_close_time')?.setting_value || '22:00';
    
    const schedule = {};
    const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    daysOfWeek.forEach(day => {
      const dayString = format(day, 'yyyy-MM-dd');
      schedule[dayString] = [];
      const dayStartTime = new Date(`${dayString}T${openTime}:00`); 
      const dayEndTime = new Date(`${dayString}T${closeTime}:00`);
      
      for (let i = dayStartTime; i < dayEndTime; i.setMinutes(i.getMinutes() + 30)) {
        const slotTime = new Date(i);
        let slotInfo = { startTime: slotTime.toISOString(), status: 'available' };
        
        const conflictingBooking = bookingsResult.rows.find(b => slotTime >= new Date(b.start_time) && slotTime < new Date(b.end_time));
        const conflictingBlock = blockedResult.rows.find(b => slotTime >= new Date(b.start_time) && slotTime < new Date(b.end_time));

        // Inject waitlist count for any slot (useful if it's booked)
        slotInfo.waitlistCount = waitlistCounts[slotInfo.startTime] || 0;

        if (conflictingBlock) {
          slotInfo.status = 'blocked';
          slotInfo.reason = conflictingBlock.reason;
        } else if (conflictingBooking) {
          slotInfo.bookingId = conflictingBooking.id;

          // REFACTORIZAMOS LA LÓGICA DE ESTADO
          const isOwner = conflictingBooking.user_id === userId;
          const isParticipant = myParticipantBookingIds.includes(conflictingBooking.id);

          if (conflictingBooking.is_open_match) {
              const participants = participantCounts[conflictingBooking.id] || 0;
              slotInfo.participants = participants;
              slotInfo.maxParticipants = conflictingBooking.max_participants;

              if (isOwner || isParticipant) {
                  slotInfo.status = 'my_open_match';
                  slotInfo.participation_type = isOwner ? 'owner' : 'participant';
              } else {
                  slotInfo.status = participants >= conflictingBooking.max_participants ? 'open_match_full' : 'open_match_available';
              }
          } else { // Reserva privada
              if (isOwner) {
                  slotInfo.status = 'my_private_booking';
              } else {
                  slotInfo.status = 'booked';
              }
          }
        }
        schedule[dayString].push(slotInfo);
      }
    });

    res.json({ weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), schedule: schedule });

  } catch (error) {
    console.error('Error al obtener el calendario semanal:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const getDaySchedule = async (req, res) => {
    const { courtId, date } = req.query;
    const userId = req.user.id; // Asumiendo que el ID de usuario está en req.user.id

    if (!courtId || !date) {
        return res.status(400).json({ message: 'Se requiere courtId y date.' });
    }

    try {
        const targetDate = parseISO(date);
        const startOfTargetDate = startOfDay(targetDate);
        const endOfTargetDate = endOfDay(targetDate);

        // 1. Obtener todas las reservas y bloqueos del día
        const bookingsResult = await pool.query(
            `SELECT b.id, b.user_id, b.start_time, b.end_time, b.is_open_match, b.max_participants,
                    (SELECT COUNT(*)::int FROM match_participants mp WHERE mp.booking_id = b.id) as participants_count
             FROM bookings b
             WHERE b.court_id = $1 AND b.status = 'confirmed' AND b.start_time >= $2 AND b.start_time < $3`,
            [courtId, startOfTargetDate, endOfTargetDate]
        );
        
        const myParticipantBookingsResult = await pool.query(
            `SELECT booking_id FROM match_participants WHERE user_id = $1`, [userId]
        );
        const myParticipantBookingIds = myParticipantBookingsResult.rows.map(r => r.booking_id);

        const blockedResult = await pool.query(
            "SELECT start_time, end_time, reason FROM blocked_periods WHERE court_id = $1 AND start_time >= $2 AND end_time <= $3",
            [courtId, startOfTargetDate, endOfTargetDate]
        );

        const settingsResult = await pool.query(
            "SELECT setting_key, setting_value FROM instance_settings WHERE setting_key IN ('operating_open_time', 'operating_close_time')"
        );

        // 2. Procesar los datos
        const bookings = bookingsResult.rows;
        const blockedPeriods = blockedResult.rows;
        const openTime = settingsResult.rows.find(s => s.setting_key === 'operating_open_time')?.setting_value || '08:00';
        const closeTime = settingsResult.rows.find(s => s.setting_key === 'operating_close_time')?.setting_value || '22:00';

        // 3. Generar los slots del día
        const daySlots = [];
        const dayString = format(targetDate, 'yyyy-MM-dd');
        const dayStartTime = new Date(`${dayString}T${openTime}:00`);
        const dayEndTime = new Date(`${dayString}T${closeTime}:00`);
        
        for (let i = new Date(dayStartTime); i < dayEndTime; i.setMinutes(i.getMinutes() + 30)) {
            const slotTime = new Date(i);
            let slotInfo = { 
                startTime: slotTime.toISOString(), 
                status: 'available',
                availableDurations: [] 
            };

            const conflictingBooking = bookings.find(b => slotTime >= new Date(b.start_time) && slotTime < new Date(b.end_time));
            const conflictingBlock = blockedPeriods.find(b => slotTime >= new Date(b.start_time) && slotTime < new Date(b.end_time));
            
            if (conflictingBlock) {
                slotInfo.status = 'blocked';
                slotInfo.reason = conflictingBlock.reason;
            } else if (conflictingBooking) {
                slotInfo.bookingId = conflictingBooking.id;

                // Es mi reserva?
                if (conflictingBooking.user_id === userId) {
                    slotInfo.status = 'my_private_booking';
                } else if (myParticipantBookingIds.includes(conflictingBooking.id)) {
                    slotInfo.status = 'my_joined_match';
                }
                // Es partida abierta?
                else if (conflictingBooking.is_open_match) {
                    const participants = conflictingBooking.participants_count;
                    if (participants >= conflictingBooking.max_participants) {
                        slotInfo.status = 'open_match_full';
                    } else {
                        slotInfo.status = 'open_match_available';
                    }
                    slotInfo.participants = participants;
                    slotInfo.maxParticipants = conflictingBooking.max_participants;
                } else {
                    slotInfo.status = 'booked';
                }
            } else {
                // Calcular duraciones disponibles si el slot está libre
                const endTime60 = new Date(slotTime.getTime() + 60 * 60000);
                if (isSlotAvailable(slotTime, endTime60, bookings, blockedPeriods) && endTime60 <= dayEndTime) {
                    slotInfo.availableDurations.push(60);
                }
                const endTime90 = new Date(slotTime.getTime() + 90 * 60000);
                if (isSlotAvailable(slotTime, endTime90, bookings, blockedPeriods) && endTime90 <= dayEndTime) {
                    slotInfo.availableDurations.push(90);
                }
                 // Si es 'available' pero no hay duraciones, no lo mostramos
                if (slotInfo.availableDurations.length === 0) {
                   continue;
                }
            }
            daySlots.push(slotInfo);
        }
        res.json(daySlots);
    } catch (error) {
        console.error('Error fetching daily schedule:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


module.exports = {
  getAvailability,
  getWeekSchedule,
  getDaySchedule,
};
