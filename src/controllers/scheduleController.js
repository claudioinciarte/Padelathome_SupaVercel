const pool = require('../config/database');
const { format } = require('date-fns');
const { fromZonedTime, formatInTimeZone } = require('date-fns-tz');

// Zona horaria de la comunidad. En Vercel las funciones corren en UTC y el
// runtime ignora process.env.TZ, así que TODO el cálculo de días/horarios se
// hace explícito con date-fns-tz (IANA).
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Madrid';

// --- Funciones auxiliares ---
function isSlotAvailable(start, end, bookings, blocked) {
    for (const booking of bookings) {
        if (start < new Date(booking.end_time) && end > new Date(booking.start_time)) return false;
    }
    for (const block of blocked) {
        if (start < new Date(block.end_time) && end > new Date(block.start_time)) return false;
    }
    return true;
}

// Convierte 'yyyy-MM-dd' a un instante en la zona horaria de la app
function dateOnlyToUtc(dateStr) {
    return fromZonedTime(`${dateStr}T00:00:00`, APP_TIMEZONE);
}

// Devuelve el inicio y fin (instantes) de un día de calendario en la zona horaria de la app
function dayBounds(dateStr) {
    const start = fromZonedTime(`${dateStr}T00:00:00`, APP_TIMEZONE);
    const end = fromZonedTime(`${dateStr}T23:59:59.999`, APP_TIMEZONE);
    return { start, end };
}

// Día de la semana de una fecha 'yyyy-MM-dd' (1=Lunes ... 7=Domingo)
function getWeekdayNumber(dateStr) {
    return parseInt(formatInTimeZone(fromZonedTime(`${dateStr}T12:00:00`, 'UTC'), 'UTC', 'i'), 10);
}

// Suma/resta días a una fecha 'yyyy-MM-dd' usando aritmética de calendario (UTC)
function shiftDateStr(dateStr, days) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// --- getAvailability (disponibilidad de un día) ---
const getAvailability = async (req, res) => {
    const { courtId, date } = req.query;
    if (!courtId || !date) {
        return res.status(400).json({ message: 'Se requiere courtId y date.' });
    }
    try {
        const { start: startOfTargetDate, end: endOfTargetDate } = dayBounds(date);
        const [bookingsResult, blockedResult, settingsResult] = await Promise.all([
            pool.query("SELECT start_time, end_time FROM bookings WHERE court_id = $1 AND status = 'confirmed' AND start_time >= $2 AND start_time <= $3", [courtId, startOfTargetDate, endOfTargetDate]),
            pool.query("SELECT start_time, end_time, reason FROM blocked_periods WHERE court_id = $1 AND start_time >= $2 AND start_time <= $3", [courtId, startOfTargetDate, endOfTargetDate]),
            pool.query("SELECT setting_value FROM instance_settings WHERE setting_key IN ('operating_open_time', 'operating_close_time')")
        ]);
        const bookings = bookingsResult.rows;
        const blockedPeriods = blockedResult.rows;
        const openTime = settingsResult.rows.find(s => s.setting_key === 'operating_open_time')?.setting_value || '08:00';
        const closeTime = settingsResult.rows.find(s => s.setting_key === 'operating_close_time')?.setting_value || '22:00';
        const availableSlots = [];
        const dayStartTime = fromZonedTime(`${date}T${openTime}:00`, APP_TIMEZONE);
        const dayEndTime = fromZonedTime(`${date}T${closeTime}:00`, APP_TIMEZONE);
        for (let i = dayStartTime; i < dayEndTime; i = new Date(i.getTime() + 30 * 60000)) {
            const potentialStartTime = new Date(i);
            const availableDurations = [];
            const endTime60 = new Date(potentialStartTime.getTime() + 60 * 60000);
            if (isSlotAvailable(potentialStartTime, endTime60, bookings, blockedPeriods) && endTime60 <= dayEndTime) {
                availableDurations.push(60);
            }
            const endTime90 = new Date(potentialStartTime.getTime() + 90 * 60000);
            if (isSlotAvailable(potentialStartTime, endTime90, bookings, blockedPeriods) && endTime90 <= dayEndTime) {
                availableDurations.push(90);
            }
            if (availableDurations.length > 0) {
                availableSlots.push({ startTime: potentialStartTime.toISOString(), availableDurations });
            }
        }
        res.json({ availability: availableSlots, blocked: blockedPeriods });
    } catch (error) {
        console.error('Error al obtener disponibilidad:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- getWeekSchedule (calendario semanal) ---
const getWeekSchedule = async (req, res) => {
  const { courtId, date } = req.query;
  const userId = req.user.id;

  if (!courtId || !date) {
    return res.status(400).json({ message: 'Se requiere courtId y date.' });
  }
  try {
    // Semana (L-D) en la zona horaria de la app, a partir de la fecha pedida
    const weekday = getWeekdayNumber(date); // 1=Lun..7=Dom
    const mondayStr = shiftDateStr(date, -(weekday - 1));
    const sundayStr = shiftDateStr(mondayStr, 6);
    const weekStart = fromZonedTime(`${mondayStr}T00:00:00`, APP_TIMEZONE);
    const weekEnd = fromZonedTime(`${sundayStr}T23:59:59.999`, APP_TIMEZONE);

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
    for (let d = 0; d < 7; d++) {
      const dayString = shiftDateStr(mondayStr, d);
      schedule[dayString] = [];
      const dayStartTime = fromZonedTime(`${dayString}T${openTime}:00`, APP_TIMEZONE);
      const dayEndTime = fromZonedTime(`${dayString}T${closeTime}:00`, APP_TIMEZONE);

      for (let i = dayStartTime; i < dayEndTime; i = new Date(i.getTime() + 30 * 60000)) {
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
    }

    res.json({ weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), schedule: schedule });

  } catch (error) {
    console.error('Error al obtener el calendario semanal:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- getDaySchedule (vista de un día) ---
const getDaySchedule = async (req, res) => {
    const { courtId, date } = req.query;
    const userId = req.user.id;

    if (!courtId || !date) {
        return res.status(400).json({ message: 'Se requiere courtId y date.' });
    }

    try {
        const { start: startOfTargetDate, end: endOfTargetDate } = dayBounds(date);

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

        // 3. Generar los slots del día (zona horaria de la app)
        const daySlots = [];
        const dayStartTime = fromZonedTime(`${date}T${openTime}:00`, APP_TIMEZONE);
        const dayEndTime = fromZonedTime(`${date}T${closeTime}:00`, APP_TIMEZONE);

        for (let i = new Date(dayStartTime); i < dayEndTime; i = new Date(i.getTime() + 30 * 60000)) {
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
