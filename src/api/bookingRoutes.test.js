const request = require('supertest');
const express = require('express');
const bookingRoutes = require('./bookingRoutes');
const authMiddleware = require('../middleware/authMiddleware');
const bookingController = require('../controllers/bookingController');

// Mock the dependencies
jest.mock('../middleware/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { id: 1 }; // Mock user
    next();
  },
  isAdmin: (req, res, next) => next(),
}));

jest.mock('../controllers/bookingController', () => ({
  createBooking: jest.fn(),
  getMyBookings: jest.fn(),
  cancelMyBooking: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/bookings', bookingRoutes);

describe('Booking Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bookings', () => {
    it('should call createBooking controller when creating a booking', async () => {
      const bookingData = {
        courtId: 1,
        startTime: '2025-12-01T10:00:00.000Z',
        durationMinutes: 90,
        isOpenMatch: false,
      };

      bookingController.createBooking.mockImplementation((req, res) => res.status(201).json({ id: 1, ...bookingData }));

      await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(201);

      expect(bookingController.createBooking).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/bookings/me', () => {
    it('should call getMyBookings controller', async () => {
      bookingController.getMyBookings.mockImplementation((req, res) => res.status(200).json([{ id: 1 }]));

      await request(app)
        .get('/api/bookings/me')
        .expect(200);

      expect(bookingController.getMyBookings).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/bookings/:bookingId', () => {
    it('should call cancelMyBooking controller', async () => {
      bookingController.cancelMyBooking.mockImplementation((req, res) => res.status(200).json({ message: 'Booking cancelled' }));

      await request(app)
        .delete('/api/bookings/1')
        .expect(200);

      expect(bookingController.cancelMyBooking).toHaveBeenCalledTimes(1);
    });
  });
});
