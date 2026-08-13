const request = require('supertest');
const express = require('express');
const courtRoutes = require('./courtRoutes');
const pool = require('../config/database');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// Mock the pool object
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Mock the auth middleware
jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((req, res, next) => {
    req.user = { id: 1, role: 'user' }; // Default to a logged-in user
    next();
  }),
  isAdmin: jest.fn((req, res, next) => {
    req.user.role = 'admin'; // Default to an admin user for admin routes
    next();
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/courts', courtRoutes);

describe('Court Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/courts', () => {
    it('should get all active courts for a regular user', async () => {
      const courts = [
        { id: 1, name: 'Court 1', is_active: true },
        { id: 2, name: 'Court 2', is_active: false },
      ];
      pool.query.mockResolvedValue({ rows: courts });
      protect.mockImplementationOnce((req, res, next) => {
        req.user = { id: 1, role: 'user' };
        next();
      });

      const res = await request(app).get('/api/courts');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toEqual(1);
    });

    it('should get all courts (including inactive) for an admin', async () => {
      const courts = [
        { id: 1, name: 'Court 1', is_active: true },
        { id: 2, name: 'Court 2', is_active: false },
      ];
      pool.query.mockResolvedValue({ rows: courts });
      protect.mockImplementationOnce((req, res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
      });

      const res = await request(app).get('/api/courts');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST /api/courts', () => {
    it('should create a new court (admin only)', async () => {
      const newCourt = { id: 3, name: 'Court 3' };
      pool.query.mockResolvedValue({ rows: [newCourt] });

      const res = await request(app)
        .post('/api/courts')
        .send({ name: 'Court 3', description: 'Nueva pista' });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newCourt);
    });

    it('should return 403 if non-admin tries to create a court', async () => {
      isAdmin.mockImplementationOnce((req, res, next) => {
        res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
      });

      const res = await request(app)
        .post('/api/courts')
        .send({ name: 'Court 4' });

      expect(res.statusCode).toEqual(403);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/courts')
        .send({ description: 'Sin nombre' });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'El nombre de la pista es requerido.');
    });
  });

  describe('PUT /api/courts/:courtId', () => {
    it('should update a court (admin only)', async () => {
      const updatedCourt = { id: 1, name: 'Court 1 Updated' };
      pool.query.mockResolvedValue({ rows: [updatedCourt] });

      const res = await request(app)
        .put('/api/courts/1')
        .send({ name: 'Court 1 Updated' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(updatedCourt);
    });

    it('should return 404 if court not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .put('/api/courts/999')
        .send({ name: 'No existe' });

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Pista no encontrada.');
    });
  });
});
