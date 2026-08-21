const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../services/emailService');
const { renderTemplate } = require('../services/emailTemplateService');

// Nota: La función 'registerUser' se mantiene para el registro público
// aunque el flujo principal ahora es 'inviteUser' (en adminController)
const registerUser = async (req, res) => {
  const { name, email, password, building, floor, door } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos.' });
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Buscamos el ID del edificio basado en la dirección de texto (ajustar si es necesario)
    const buildingResult = await pool.query("SELECT id FROM buildings WHERE address = $1", [building]);
    const building_id = buildingResult.rows.length > 0 ? buildingResult.rows[0].id : null;

    const newUser = await pool.query(
      "INSERT INTO users (name, email, password_hash, building_id, floor, door) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, account_status",
      [name, email, password_hash, building_id, floor, door]
    );
    res.status(201).json({
      message: "Registro exitoso. Tu cuenta está pendiente de aprobación.",
      user: newUser.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'El correo electrónico ya está en uso.' });
    }
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
  }
  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    const user = userResult.rows[0];

    if (user.account_status !== 'active') {
      return res.status(403).json({ message: 'Tu cuenta está inactiva o pendiente de aprobación.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const payload = { id: user.id, role: user.role, name: user.name, email: user.email };
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: "Inicio de sesión exitoso.",
      token: token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const client = await pool.connect();
  try {
    const userResult = await client.query("SELECT * FROM users WHERE email = $1 AND account_status = 'active'", [email]);
    if (userResult.rows.length === 0) {
      // No revelamos si el usuario existe o no
      return res.json({ message: 'Si tu cuenta existe, se ha enviado un enlace para restablecer la contraseña.' });
    }
    const user = userResult.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
    await client.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [resetToken, user.id, expires_at]);

    const resetUrl = `${process.env.APP_URL || ''}/reset-password.html?token=${resetToken}`;
    const { subject, html } = await renderTemplate('auth.password-reset', { userName: user.name, resetUrl });
    await sendEmail({
      to: user.email,
      subject,
      html
    });
    res.json({ message: 'Si tu cuenta existe, se ha enviado un enlace para restablecer la contraseña.' });
  } catch (error) {
    console.error("Error en forgotPassword:", error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token y nueva contraseña son requeridos.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query("SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()", [token]);
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ message: 'El token es inválido o ha expirado.' });
    }
    const userId = tokenResult.rows[0].user_id;
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, userId]);
    await client.query("DELETE FROM password_reset_tokens WHERE token = $1", [token]);
    await client.query('COMMIT');
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error en resetPassword:", error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// --- AÑADE ESTA NUEVA FUNCIÓN ---
const getRegistrationStatus = async (req, res) => {
  try {
    const result = await pool.query("SELECT setting_value FROM instance_settings WHERE setting_key = 'allow_public_registration'");
    let status = 'false'; // Por defecto es falso (más seguro)
    if (result.rows.length > 0) {
      status = result.rows[0].setting_value;
    }
    res.json({ allowRegistration: status === 'true' });
  } catch (error) {
    console.error('Error al obtener el estado del registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// Actualiza el module.exports al final del archivo
module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getRegistrationStatus // <-- añade esto
};