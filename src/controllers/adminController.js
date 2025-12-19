const pool = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sendEmail = require('../services/emailService');

// --- Funciones de Gestión de Usuarios ---
const getAllUsers = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `SELECT u.id, u.name, u.email, u.floor, u.door, u.phone_number, u.role, u.account_status, b.address as building_address FROM users u LEFT JOIN buildings b ON u.building_id = b.id`;
    const queryParams = [];
    if (status || search) {
      query += " WHERE";
      let paramIndex = 1;
      if (status) {
        query += ` u.account_status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }
      if (search) {
        if(queryParams.length > 0) query += " AND";
        query += ` (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
      }
    }
    query += " ORDER BY u.created_at DESC";
    const { rows } = await pool.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query("UPDATE users SET account_status = 'active' WHERE id = $1 AND account_status = 'pending_approval' RETURNING *", [userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado o ya está activo.' });
    const approvedUser = result.rows[0];
    sendEmail({ to: approvedUser.email, subject: '¡Tu cuenta en Padel@Home ha sido aprobada!', html: `<h3>¡Hola, ${approvedUser.name}!</h3><p>Tu cuenta ha sido aprobada. ¡Ya puedes iniciar sesión!</p>` });
    res.json({ message: 'Usuario aprobado exitosamente.', user: { id: approvedUser.id, name: approvedUser.name, account_status: approvedUser.account_status }});
  } catch (error) {
    console.error('Error al aprobar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ message: 'El estado proporcionado no es válido.' });
    const result = await pool.query("UPDATE users SET account_status = $1 WHERE id = $2 RETURNING id, name, account_status", [status, userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json({ message: `El estado del usuario ha sido actualizado a '${status}'.`, user: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el estado del usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const inviteUser = async (req, res) => {
  const { name, email, buildingId, building_id, floor, door, phone_number } = req.body;
  const buildingIdToUse = buildingId || building_id;

  if (!name || !email || !buildingIdToUse) return res.status(400).json({ message: 'Nombre, email y edificio son requeridos.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tempPassword = crypto.randomBytes(20).toString('hex');
    const password_hash = await bcrypt.hash(tempPassword, 10);
    // Allow phone_number to be null
    const phoneNumber = phone_number || null;
    const newUserResult = await client.query("INSERT INTO users (name, email, password_hash, building_id, floor, door, phone_number, account_status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id, name, email", [name, email, password_hash, parseInt(buildingIdToUse), floor, door, phoneNumber]);
    const newUser = newUserResult.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await client.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [resetToken, newUser.id, expires_at]);
    const setPasswordUrl = `${process.env.APP_URL}/reset-password.html?token=${resetToken}`;
    sendEmail({ to: newUser.email, subject: '¡Bienvenido a Padel@Home! Establece tu contraseña', html: `<h3>¡Hola, ${newUser.name}!</h3><p>Un administrador te ha creado una cuenta en Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer tu contraseña. El enlace es válido por 24 horas.</p><a href="${setPasswordUrl}">Establecer mi contraseña</a>`});
    await client.query('COMMIT');
    res.status(201).json({ message: 'Usuario invitado exitosamente.', user: newUser });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(400).json({ message: 'El correo electrónico ya está en uso.' });
    console.error('Error al invitar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

const resetUserPassword = async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    const user = userResult.rows[0];

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas de validez

    await client.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [resetToken, user.id, expires_at]);

    const setPasswordUrl = `${process.env.APP_URL}/reset-password.html?token=${resetToken}`;
    sendEmail({
      to: user.email,
      subject: 'Restablecimiento de Contraseña para Padel@Home',
      html: `<h3>¡Hola, ${user.name}!</h3><p>Se ha solicitado un restablecimiento de contraseña para tu cuenta de Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer una nueva contraseña. El enlace es válido por 24 horas.</p><a href="${setPasswordUrl}">Establecer nueva contraseña</a><p>Si no solicitaste este cambio, por favor ignora este correo.</p>`
    });

    await client.query('COMMIT');
    res.status(200).json({ message: 'Enlace de restablecimiento de contraseña enviado al correo del usuario.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al solicitar restablecimiento de contraseña para usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'El rol proporcionado no es válido. Debe ser "user" o "admin".' });
    }

    const result = await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role",
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    res.json({ message: `Rol del usuario actualizado a '${role}'.`, user: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el rol del usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- Funciones de Gestión de Pistas ---
const createCourt = async (req, res) => {
  const { name, buildingId, description, is_active } = req.body;
  if (!name || !buildingId) return res.status(400).json({ message: 'Nombre y edificio son requeridos.' });
  try {
    const { rows } = await pool.query(
      "INSERT INTO courts (name, building_id, description, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, parseInt(buildingId), description, is_active !== undefined ? is_active : true]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear la pista:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const getAllCourts = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM courts ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las pistas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { name, buildingId, description, is_active } = req.body;
    const { rows } = await pool.query(
      "UPDATE courts SET name = $1, building_id = $2, description = $3, is_active = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
      [name, parseInt(buildingId), description, is_active, courtId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Pista no encontrada.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar la pista:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const deleteCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const result = await pool.query("DELETE FROM courts WHERE id = $1", [courtId]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Pista no encontrada.' });
    res.json({ message: 'Pista eliminada exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar la pista:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- Funciones de Gestión de Edificios ---
const createBuilding = async (req, res) => {
  const { address, description } = req.body;
  if (!address) return res.status(400).json({ message: 'La dirección del edificio es requerida.' });
  try {
    const { rows } = await pool.query("INSERT INTO buildings (address, description) VALUES ($1, $2) RETURNING *", [address, description]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear el edificio:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const getAllBuildings = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM buildings ORDER BY address ASC");
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los edificios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateBuilding = async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { address, description } = req.body;
    const { rows } = await pool.query("UPDATE buildings SET address = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *", [address, description, buildingId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Edificio no encontrado.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar el edificio:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const deleteBuilding = async (req, res) => {
  try {
    const { buildingId } = req.params;
    const result = await pool.query("DELETE FROM buildings WHERE id = $1", [buildingId]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Edificio no encontrado.' });
    res.json({ message: 'Edificio eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar el edificio:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- Funciones de Gestión de Bloqueos ---
const createBlockedPeriod = async (req, res) => {
  const { courtId, startTime, endTime, reason, is_full_day } = req.body;
  if (!courtId || !startTime || !endTime) return res.status(400).json({ message: 'courtId, startTime y endTime son requeridos.' });
  try {
    const { rows } = await pool.query("INSERT INTO blocked_periods (court_id, start_time, end_time, reason, is_full_day) VALUES ($1, $2, $3, $4, $5) RETURNING *", [courtId, startTime, endTime, reason, is_full_day || false]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear período de bloqueo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const deleteBlockedPeriod = async (req, res) => {
  try {
    const { blockedPeriodId } = req.params;
    const result = await pool.query("DELETE FROM blocked_periods WHERE id = $1", [blockedPeriodId]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Período de bloqueo no encontrado.' });
    res.json({ message: 'Período de bloqueo eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar período de bloqueo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const getBlockedPeriods = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT bp.*, c.name as court_name FROM blocked_periods bp JOIN courts c ON c.id = bp.court_id WHERE bp.end_time > NOW() ORDER BY bp.start_time ASC");
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener períodos de bloqueo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// --- Funciones de Gestión de Ajustes ---
const getSettings = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT setting_key, setting_value FROM instance_settings");
    const settingsObject = rows.reduce((acc, row) => { acc[row.setting_key] = row.setting_value; return acc; }, {});
    res.json(settingsObject);
  } catch (error) {
    console.error('Error al obtener los ajustes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateSettings = async (req, res) => {
  const settingsToUpdate = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const key in settingsToUpdate) {
      const value = settingsToUpdate[key];
      await client.query("UPDATE instance_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2", [value, key]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Ajustes actualizados exitosamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar los ajustes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// --- AÑADE ESTA NUEVA FUNCIÓN ---
const getDashboardStats = async (req, res) => {
  try {
    // 1. Total de reservas en los últimos 30 días
    const totalBookingsResult = pool.query(
      "SELECT COUNT(*) as total_bookings FROM bookings WHERE status = 'confirmed' AND start_time > NOW() - INTERVAL '30 days'"
    );

    // 2. Usuarios más activos (Top 3)
    const topUsersResult = pool.query(
      `SELECT u.name, COUNT(b.id) as booking_count
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.status = 'confirmed' AND b.start_time > NOW() - INTERVAL '30 days'
       GROUP BY u.name
       ORDER BY booking_count DESC
       LIMIT 3`
    );

    // 3. Horas pico (agrupadas por hora del día)
    const peakHoursResult = pool.query(
      `SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
       FROM bookings
       WHERE status = 'confirmed' AND start_time > NOW() - INTERVAL '30 days'
       GROUP BY hour
       ORDER BY count DESC`
    );

    // 4. Reservas Activas Ahora
    const activeBookingsResult = pool.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE status = 'confirmed'
       AND start_time <= NOW() AND end_time >= NOW()`
    );

    // 5. Partidas Abiertas Activas (Futuras o en curso)
    const activeOpenMatchesResult = pool.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE status = 'confirmed' AND is_open_match = TRUE
       AND end_time > NOW()`
    );

    // 6. Pistas Disponibles
    const totalCourtsResult = pool.query("SELECT COUNT(*) as count FROM courts WHERE is_active = TRUE");
    const occupiedCourtsResult = pool.query(
      `SELECT COUNT(DISTINCT court_id) as count FROM bookings
       WHERE status = 'confirmed' AND start_time <= NOW() AND end_time >= NOW()`
    );
    const blockedCourtsResult = pool.query(
      `SELECT COUNT(DISTINCT court_id) as count FROM blocked_periods
       WHERE start_time <= NOW() AND end_time >= NOW()`
    );

    // Ejecutamos todas las consultas en paralelo
    const [totalBookings, topUsers, peakHours, activeBookings, activeOpenMatches, totalCourts, occupiedCourts, blockedCourts] = await Promise.all([
      totalBookingsResult,
      topUsersResult,
      peakHoursResult,
      activeBookingsResult,
      activeOpenMatchesResult,
      totalCourtsResult,
      occupiedCourtsResult,
      blockedCourtsResult
    ]);

    const totalActiveCourts = parseInt(totalCourts.rows[0].count) || 0;
    const occupiedCount = parseInt(occupiedCourts.rows[0].count) || 0;
    const blockedCount = parseInt(blockedCourts.rows[0].count) || 0;

    const availableCourtsCount = Math.max(0, totalActiveCourts - (occupiedCount + blockedCount));

    // Formateamos la respuesta
    const stats = {
      totalBookings: totalBookings.rows[0].total_bookings || 0,
      topUsers: topUsers.rows,
      peakHours: peakHours.rows,
      activeBookingsNow: activeBookings.rows[0].count || 0,
      activeOpenMatches: activeOpenMatches.rows[0].count || 0,
      availableCourts: availableCourtsCount,
      totalCourts: totalActiveCourts
    };

    res.json(stats);

  } catch (error) {
    console.error('Error al obtener las estadísticas del dashboard:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};


// --- Exportamos TODAS las funciones del controlador ---
module.exports = {
  getAllUsers,
  approveUser,
  updateUserStatus,
  inviteUser,
  createBuilding,
  getAllBuildings,
  updateBuilding,
  deleteBuilding,
  createCourt,
  getAllCourts,
  updateCourt,
  deleteCourt,
  createBlockedPeriod,
  deleteBlockedPeriod,
  getBlockedPeriods,
  getSettings,
  updateSettings,
  getDashboardStats,
  resetUserPassword,
  updateUserRole, // <-- añade esto
};