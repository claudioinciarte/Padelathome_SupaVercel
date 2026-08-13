const request = require('supertest');
const express = require('express');
const scheduleRoutes = require('./scheduleRoutes');
const pool = require('../config/database');
const { protect } = require('../middleware/authMiddleware');

// Mock the pool object
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Mock the auth middleware
jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((req, res, next) => {
    req.user = { id: 1, role: 'user' }; // Mock a logged-in user
    next();
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/schedule', scheduleRoutes);

describe('Schedule Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/schedule/week', () => {
    it('should correctly identify booked slots', async () => {
      const bookings = [
        { id: 1, user_id: 2, start_time: '2025-11-10T10:00:00Z', end_time: '2025-11-10T11:00:00Z', is_open_match: false },
      ];
      const myParticipantBookings = [];
      const blockedPeriods = [];
      const participants = [];
      const settings = [
        { setting_key: 'operating_open_time', setting_value: '08:00' },
        { setting_key: 'operating_close_time', setting_value: '22:00' },
      ];
      const waitlist = [];

      pool.query
        .mockResolvedValueOnce({ rows: bookings })
        .mockResolvedValueOnce({ rows: myParticipantBookings })
        .mockResolvedValueOnce({ rows: blockedPeriods })
        .mockResolvedValueOnce({ rows: participants })
        .mockResolvedValueOnce({ rows: settings })
        .mockResolvedValueOnce({ rows: waitlist });

      const res = await request(app).get('/api/schedule/week?courtId=1&date=2025-11-10');

      expect(res.statusCode).toEqual(200);
      const scheduleForDay = res.body.schedule['2025-11-10'];
      const bookedSlot = scheduleForDay.find(slot => slot.startTime === '2025-11-10T10:00:00.000Z');
      expect(bookedSlot.status).toBe('booked');
    });

    it('should correctly identify open match slots', async () => {
      const bookings = [
        { id: 1, user_id: 2, start_time: '2025-11-10T11:00:00Z', end_time: '2025-11-10T12:00:00Z', is_open_match: true, max_participants: 4 },
        { id: 2, user_id: 3, start_time: '2025-11-10T14:00:00Z', end_time: '2025-11-10T15:00:00Z', is_open_match: true, max_participants: 2 },
      ];
      const myParticipantBookings = [];
      const blockedPeriods = [];
      const participants = [
        { booking_id: 2, participant_count: '2' },
      ];
      const settings = [
        { setting_key: 'operating_open_time', setting_value: '08:00' },
        { setting_key: 'operating_close_time', setting_value: '22:00' },
      ];
      const waitlist = [];

      pool.query
        .mockResolvedValueOnce({ rows: bookings })
        .mockResolvedValueOnce({ rows: myParticipantBookings })
        .mockResolvedValueOnce({ rows: blockedPeriods })
        .mockResolvedValueOnce({ rows: participants })
        .mockResolvedValueOnce({ rows: settings })
        .mockResolvedValueOnce({ rows: waitlist });

      const res = await request(app).get('/api/schedule/week?courtId=1&date=2025-11-10');

      expect(res.statusCode).toEqual(200);
      const scheduleForDay = res.body.schedule['2025-11-10'];
      const openMatchAvailableSlot = scheduleForDay.find(slot => slot.startTime === '2025-11-10T11:00:00.000Z');
      const openMatchFullSlot = scheduleForDay.find(slot => slot.startTime === '2025-11-10T14:00:00.000Z');
      expect(openMatchAvailableSlot.status).toBe('open_match_available');
      expect(openMatchFullSlot.status).toBe('open_match_full');
    });

    it('should correctly identify blocked periods', async () => {
      const bookings = [];
      const myParticipantBookings = [];
      const blockedPeriods = [
        { start_time: '2025-11-10T12:00:00Z', end_time: '2025-11-10T13:00:00Z', reason: 'Maintenance' },
      ];
      const participants = [];
      const settings = [
        { setting_key: 'operating_open_time', setting_value: '08:00' },
        { setting_key: 'operating_close_time', setting_value: '22:00' },
      ];
      const waitlist = [];

      pool.query
        .mockResolvedValueOnce({ rows: bookings })
        .mockResolvedValueOnce({ rows: myParticipantBookings })
        .mockResolvedValueOnce({ rows: blockedPeriods })
        .mockResolvedValueOnce({ rows: participants })
        .mockResolvedValueOnce({ rows: settings })
        .mockResolvedValueOnce({ rows: waitlist });

      const res = await request(app).get('/api/schedule/week?courtId=1&date=2025-11-10');

      expect(res.statusCode).toEqual(200);
      const scheduleForDay = res.body.schedule['2025-11-10'];
      const blockedSlot = scheduleForDay.find(slot => slot.startTime === '2025-11-10T12:00:00.000Z');
      expect(blockedSlot.status).toBe('blocked');
      expect(blockedSlot.reason).toBe('Maintenance');
    });
  });

  describe('GET /api/schedule/availability', () => {
    it('should get the availability for a specific day', async () => {
      const bookings = [];
      const blockedPeriods = [
        { start_time: '2025-11-10T12:00:00Z', end_time: '2025-11-10T13:00:00Z', reason: 'Maintenance' },
      ];
      const settings = [
        { setting_key: 'operating_open_time', setting_value: '08:00' },
        { setting_key: 'operating_close_time', setting_value: '22:00' },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: bookings })
        .mockResolvedValueOnce({ rows: blockedPeriods })
        .mockResolvedValueOnce({ rows: settings });

      const res = await request(app).get('/api/schedule/availability?courtId=1&date=2025-11-10');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('availability');
      expect(res.body).toHaveProperty('blocked');
      expect(res.body.blocked.length).toBe(1);
      expect(res.body.blocked[0].reason).toBe('Maintenance');
    });
  });
});
