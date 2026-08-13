const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const userRoutes = require('./userRoutes');
const pool = require('../config/database');
const { protect } = require('../middleware/authMiddleware');

// Mock the pool object
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Mock the auth middleware
jest.mock('../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { id: 1 }; // Mock a logged-in user
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('User Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('should get the profile of the logged-in user', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }] });

      const res = await request(app).get('/api/users/me');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('name', 'Test User');
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });

    it('should return 404 if user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/users/me');

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Usuario no encontrado.');
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update the profile of the logged-in user', async () => {
      const updatedUser = { id: 1, name: 'Updated User', floor: '1', door: 'A', phone_number: '123456789' };
      pool.query.mockResolvedValue({ rows: [updatedUser] });

      const res = await request(app)
        .put('/api/users/me')
        .send({
          name: 'Updated User',
          floor: '1',
          door: 'A',
          phone_number: '123456789',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Perfil actualizado con éxito.');
      expect(res.body.user).toHaveProperty('name', 'Updated User');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .send({ floor: '1' });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'El nombre es requerido.');
    });
  });

  describe('PUT /api/users/change-password', () => {
    it('should change the password of the logged-in user', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword123', 10);
      pool.query
        .mockResolvedValueOnce({ rows: [{ password_hash: hashedPassword }] }) // Current hash
        .mockResolvedValueOnce({ rows: [] }); // UPDATE

      const res = await request(app)
        .put('/api/users/change-password')
        .send({ oldPassword: 'oldpassword123', newPassword: 'newpassword123' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Contraseña actualizada con éxito.');
    });

    it('should return 401 if old password does not match', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      pool.query.mockResolvedValue({ rows: [{ password_hash: hashedPassword }] });

      const res = await request(app)
        .put('/api/users/change-password')
        .send({ oldPassword: 'incorrectpassword', newPassword: 'newpassword123' });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'La contraseña antigua no es correcta.');
    });

    it('should return 400 if fields are missing', async () => {
      const res = await request(app)
        .put('/api/users/change-password')
        .send({ oldPassword: 'onlyold' });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'La contraseña antigua y la nueva son requeridas.');
    });
  });
});
