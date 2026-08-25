const request = require('supertest');
const express = require('express');
const matchRoutes = require('./matchRoutes');
const pool = require('../config/database');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// Mock the pool object
jest.mock('../config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const pool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    query: jest.fn(),
  };
  return {
    ...pool,
    mockClient: mockClient, // Export mockClient for testing purposes
  };
});

// Mock the auth middleware
jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((req, res, next) => {
    req.user = { id: 1, role: 'user' }; // Default to a logged-in user
    next();
  }),
  isAdmin: jest.fn((req, res, next) => next()),
}));

const app = express();
app.use(express.json());
app.use('/api/matches', matchRoutes);

describe('Match Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
    require('../config/database').connect.mockClear();
    require('../config/database').query.mockClear();
    require('../config/database').mockClient.query.mockClear();
  });

  describe('GET /api/matches/open', () => {
    it('should get all open matches', async () => {
      const matches = [
        { id: 1, court_id: 1, court_name: 'Pista 1', start_time: '2025-11-10T10:00:00Z' },
      ];
      pool.query.mockResolvedValue({ rows: matches });

      const res = await request(app).get('/api/matches/open');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(matches);
    });
  });

  describe('GET /api/matches/:bookingId/details', () => {
    it('should get match details with players and messages', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, court_name: 'Pista 1', user_id: 2 }] }) // booking
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Organizador' }] }) // players
        .mockResolvedValueOnce({ rows: [{ id: 1, message: 'Hola' }] }); // messages

      const res = await request(app).get('/api/matches/1/details');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('matchInfo');
      expect(res.body).toHaveProperty('players');
      expect(res.body).toHaveProperty('messages');
      expect(res.body.matchInfo).toHaveProperty('court_name', 'Pista 1');
    });

    it('should prepend the organizer when not in match_participants', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, court_name: 'Pista 1', user_id: 2 }] }) // booking (dueño id 2)
        .mockResolvedValueOnce({ rows: [{ id: 3, name: 'Jugador' }] }) // players: NO incluye al dueño
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Organizador', role: 'user' }] }) // consulta del dueño
        .mockResolvedValueOnce({ rows: [{ id: 1, message: 'Hola' }] }); // messages

      const res = await request(app).get('/api/matches/1/details');

      expect(res.statusCode).toEqual(200);
      expect(res.body.players[0]).toMatchObject({ id: 2, name: 'Organizador' });
      expect(res.body.players).toHaveLength(2);
    });

    it('should return 404 if match not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/matches/999/details');

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Partida no encontrada');
    });
  });

  describe('POST /api/matches/:bookingId/join', () => {
    it('should allow a user to join an open match', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, is_open_match: true, max_participants: 4 }] }) // Booking exists
        .mockResolvedValueOnce({ rows: [] }) // No participants yet
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert participant
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Updated participant count
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app).post('/api/matches/1/join');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Te has unido a la partida con éxito.');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 400 if user tries to join their own match', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, is_open_match: true, max_participants: 4 }] }) // User is organizer
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app).post('/api/matches/1/join');

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'No puedes unirte a tu propia partida, ya eres el organizador.');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should return 400 if match is full', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, is_open_match: true, max_participants: 1 }] }) // Booking exists, max 1
        .mockResolvedValueOnce({ rows: [{ user_id: 3 }] }) // One participant already
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app).post('/api/matches/1/join');

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Esta partida ya está completa.');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should return 400 if user already joined', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, is_open_match: true, max_participants: 4 }] }) // Booking exists
        .mockResolvedValueOnce({ rows: [{ user_id: 1 }] }) // User already joined
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const res = await request(app).post('/api/matches/1/join');

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Ya te has unido a esta partida.');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('DELETE /api/matches/:bookingId/leave', () => {
    it('should allow a regular participant to leave (match continues)', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, court_id: 1, start_time: new Date(Date.now() + 7 * 3600 * 1000).toISOString(), auto_cancel_hours_before: 6, status: 'confirmed' }] }) // Booking exists
        .mockResolvedValueOnce({ rowCount: 1 }) // Participant deleted
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count after leaving

      const res = await request(app).delete('/api/matches/1/leave');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Has abandonado la partida correctamente.');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should transfer organizer role if organizer leaves and other participants exist', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, court_id: 1, start_time: new Date(Date.now() + 7 * 3600 * 1000).toISOString(), auto_cancel_hours_before: 6, status: 'confirmed' }] }) // User is organizer
        .mockResolvedValueOnce({ rowCount: 1 }) // Participant deleted
        .mockResolvedValueOnce({ rows: [{ user_id: 3 }] }) // Next organizer exists
        .mockResolvedValueOnce({ rowCount: 1 }) // Update booking (new organizer)
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count after leaving

      const res = await request(app).delete('/api/matches/1/leave');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Has abandonado la partida correctamente.');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE bookings SET user_id'), expect.anything());
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should cancel match if organizer leaves and no other participants exist', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, court_id: 1, start_time: new Date(Date.now() + 7 * 3600 * 1000).toISOString(), auto_cancel_hours_before: 6, status: 'confirmed' }] }) // User is organizer
        .mockResolvedValueOnce({ rowCount: 1 }) // Participant deleted
        .mockResolvedValueOnce({ rows: [] }) // No remaining participants
        .mockResolvedValueOnce({ rowCount: 1 }) // Cancel booking
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Count after leaving

      const res = await request(app).delete('/api/matches/1/leave');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Has abandonado la partida correctamente.');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("status = 'cancelled_by_admin'"), expect.anything());
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should cancel match if someone leaves within the cancellation window', async () => {
      const { mockClient, connect } = require('../config/database');
      connect.mockResolvedValue(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 2, court_id: 1, start_time: new Date(Date.now() + 5 * 3600 * 1000).toISOString(), auto_cancel_hours_before: 6, status: 'confirmed' }] }) // <6h to start
        .mockResolvedValueOnce({ rowCount: 1 }) // Participant deleted
        .mockResolvedValueOnce({ rowCount: 1 }) // Cancel booking
        .mockResolvedValueOnce({ rows: [] }) // No other participants to notify
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Count after leaving

      const res = await request(app).delete('/api/matches/1/leave');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Has abandonado la partida correctamente.');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("status = 'cancelled_by_admin'"), expect.anything());
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('POST /api/matches/:bookingId/messages', () => {
    it('should save a chat message via REST', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Booking exists
        .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // User is participant
        .mockResolvedValueOnce({ rows: [] }) // Not organizer
        .mockResolvedValueOnce({ rows: [{ id: 5, booking_id: 1, user_id: 1, message: 'Hola equipo', created_at: '2025-11-10T10:00:00Z' }] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ name: 'Jugador 1' }] }); // User name

      const res = await request(app)
        .post('/api/matches/1/messages')
        .send({ message: 'Hola equipo' });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'Hola equipo');
      expect(res.body).toHaveProperty('user_name', 'Jugador 1');
    });

    it('should return 400 if message is empty', async () => {
      const res = await request(app)
        .post('/api/matches/1/messages')
        .send({ message: '   ' });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'El mensaje no puede estar vacío.');
    });

    it('should return 403 if user does not participate in the match', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Booking exists
        .mockResolvedValueOnce({ rows: [] }) // Not participant
        .mockResolvedValueOnce({ rows: [] }); // Not organizer

      const res = await request(app)
        .post('/api/matches/1/messages')
        .send({ message: 'Hola' });

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('message', 'No participas en esta partida.');
    });
  });
});
