const pool = require('../config/database');

const getAllCourts = async (req, res) => {
  try {
    // Solo pistas activas: /api/courts es el endpoint de reserva (dashboard).
    // El panel admin usa /api/admin/courts para verlas todas (incl. inactivas).
    const { rows } = await pool.query("SELECT * FROM courts WHERE is_active = true ORDER BY name");
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las pistas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const createCourt = async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'El nombre de la pista es requerido.' });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO courts (name, description) VALUES ($1, $2) RETURNING *",
      [name, description]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear la pista:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { name, description, is_active } = req.body;
    const { rows } = await pool.query(
      "UPDATE courts SET name = $1, description = $2, is_active = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
      [name, description, is_active, courtId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Pista no encontrada.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar la pista:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

module.exports = {
  getAllCourts,
  createCourt,
  updateCourt,
};