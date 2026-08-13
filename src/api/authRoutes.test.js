const request = require('supertest');
const express = require('express');
const authRoutes = require('./authRoutes');
const pool = require('../config/database');
const bcrypt = require('bcrypt');

// Mock the pool object
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Mock the database query
      pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com', account_status: 'pending_approval' }] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'Registro exitoso. Tu cuenta está pendiente de aprobación.');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('name', 'Test User');
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
      expect(res.body.user).toHaveProperty('account_status', 'pending_approval');
    });

    it('should return 400 if required fields are missing during registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Nombre, email y contraseña son requeridos.');
    });

    it('should return 400 if email already exists during registration', async () => {
      // Mock the database query to simulate an existing email (PostgreSQL unique constraint error code '23505')
      pool.query.mockRejectedValue({ code: '23505' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Existing User',
          email: 'existing@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'El correo electrónico ya está en uso.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user successfully', async () => {
      // Mock the database query to find the user
      const hashedPassword = await bcrypt.hash('password123', 10);
      pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com', password_hash: hashedPassword, role: 'user', account_status: 'active' }] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Inicio de sesión exitoso.');
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('name', 'Test User');
      expect(res.body.user).toHaveProperty('role', 'user');
    });

    it('should return 401 for invalid credentials during login (user not found)', async () => {
      // Mock the database query to simulate user not found
      pool.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Credenciales inválidas.');
    });

    it('should return 401 for invalid credentials during login (incorrect password)', async () => {
      // Mock the database query to find the user, but bcrypt.compare will return false
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com', password_hash: hashedPassword, role: 'user', account_status: 'active' }] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'incorrectpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Credenciales inválidas.');
    });

    it('should return 403 if account is pending approval during login', async () => {
      // Mock the database query to find the user with pending_approval status
      const hashedPassword = await bcrypt.hash('password123', 10);
      pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Pending User', email: 'pending@example.com', password_hash: hashedPassword, role: 'user', account_status: 'pending_approval' }] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'pending@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('message', 'Tu cuenta está inactiva o pendiente de aprobación.');
    });

    it('should return 403 if account is inactive during login', async () => {
      // Mock the database query to find the user with inactive status
      const hashedPassword = await bcrypt.hash('password123', 10);
      pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Inactive User', email: 'inactive@example.com', password_hash: hashedPassword, role: 'user', account_status: 'inactive' }] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('message', 'Tu cuenta está inactiva o pendiente de aprobación.');
    });
  });
});
