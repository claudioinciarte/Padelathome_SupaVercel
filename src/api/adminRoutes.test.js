/**
 * Test de los endpoints de plantillas de correo (Comunicaciones).
 * Cubre:
 *  - GET /api/admin/email-templates → 200 con 7 plantillas + available_vars.
 *  - PUT /api/admin/email-templates/:key con {{variable}} válida → 200 + persiste.
 *  - PUT con {{variable}} NO disponible en CONTEXT_VARS → 400 + unknown_vars.
 *  - PUT a una key inexistente → 404.
 *  - PUT sin body / tipos incorrectos → 400.
 *  - Middleware admin protege los endpoints (sin token → 401).
 *
 * El pool de database se mockea para no tocar la DB real; se simulan
 * listTemplates (fallback a defaults) y el UPSERT + SELECT de PUT.
 */
const request = require('supertest');
const express = require('express');

// --- Mocks de dependencias ---
// Mock del pool de database: simulamos la tabla vacía (fuerza fallback en
// listTemplates/getTemplate) y capturamos los UPSERT de PUT.
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({
  query: mockQuery,
  connect: jest.fn(),
}));
const pool = require('../config/database');

// Mock del middleware de auth: por defecto autenticado como admin.
const mockProtect = jest.fn((req, res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
});
const mockIsAdmin = jest.fn((req, res, next) => next());
jest.mock('../middleware/authMiddleware', () => ({
  protect: mockProtect,
  isAdmin: mockIsAdmin,
}));

// Construimos una app Express mínima con solo el router admin
const adminRoutes = require('./adminRoutes');
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Email Templates API (Comunicaciones)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // listTemplates() ejecuta SELECT ... → devolvemos vacío para forzar fallback
    mockQuery.mockResolvedValue({ rows: [] });
  });

  // ─── GET /api/admin/email-templates ───
  describe('GET /api/admin/email-templates', () => {
    it('devuelve 200 y las 7 plantillas con available_vars', async () => {
      const res = await request(app).get('/api/admin/email-templates').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(7);
      const keys = res.body.map(t => t.key).sort();
      expect(keys).toEqual([
        'account.approved',
        'account.welcome',
        'auth.password-reset',
        'booking.confirm',
        'match.cancel',
        'password.reset',
        'waitlist.slot',
      ]);
      // Cada plantilla trae available_vars
      res.body.forEach(t => {
        expect(Array.isArray(t.available_vars)).toBe(true);
      });
      // Spot-check: booking.confirm tiene userName y date
      const bookingConfirm = res.body.find(t => t.key === 'booking.confirm');
      expect(bookingConfirm.available_vars).toEqual(['userName', 'date']);
    });

    it('devuelve datos de la DB cuando hay filas', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          key: 'booking.confirm',
          name: 'Nombre Editado',
          subject: 'Asunto Editado {{date}}',
          html_template: '<p>Editado {{userName}}</p>',
          updated_at: '2026-08-21T10:00:00Z',
        }],
      });
      const res = await request(app).get('/api/admin/email-templates').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Nombre Editado');
      expect(res.body[0].updated_at).toBe('2026-08-21T10:00:00Z');
      expect(res.body[0].available_vars).toEqual(['userName', 'date']);
    });
  });

  // ─── PUT /api/admin/email-templates/:key ───
  describe('PUT /api/admin/email-templates/:key', () => {
    it('devuelve 200 y persiste con variables válidas', async () => {
      // UPSERT RETURNING → primera llamada; SELECT posterior → segunda
      const updatedRow = {
        key: 'booking.confirm',
        name: 'Confirmación de Reserva',
        subject: 'Reserva confirmada para el {{date}}',
        html_template: '<h3>Hola {{userName}}</h3><p>Fecha: {{date}}</p>',
        updated_at: '2026-08-21T12:00:00Z',
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPSERT
        .mockResolvedValueOnce({ rows: [updatedRow] }); // SELECT

      const res = await request(app)
        .put('/api/admin/email-templates/booking.confirm')
        .send({
          subject: 'Reserva confirmada para el {{date}}',
          html_template: '<h3>Hola {{userName}}</h3><p>Fecha: {{date}}</p>',
        })
        .expect(200);

      expect(res.body.subject).toContain('{{date}}');
      expect(res.body.html_template).toContain('{{userName}}');
      expect(res.body.available_vars).toEqual(['userName', 'date']);
      // Verificamos que se hizo el UPSERT
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_templates'),
        expect.arrayContaining(['booking.confirm'])
      );
    });

    it('devuelve 400 si la plantilla usa una variable no disponible', async () => {
      const res = await request(app)
        .put('/api/admin/email-templates/booking.confirm')
        .send({
          subject: 'Hola {{maliciosa}}',
          html_template: '<p>{{maliciosa}}</p>',
        })
        .expect(400);

      expect(res.body.unknown_vars).toContain('maliciosa');
      expect(res.body.available_vars).toEqual(['userName', 'date']);
      // No se debe haber intentado persistir
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_templates'),
        expect.anything()
      );
    });

    it('devuelve 404 si la key no existe en el catálogo', async () => {
      await request(app)
        .put('/api/admin/email-templates/clave.inexistente')
        .send({
          subject: 'Asunto',
          html_template: '<p>HTML</p>',
        })
        .expect(404);
    });

    it('devuelve 400 si falta subject o html_template', async () => {
      await request(app)
        .put('/api/admin/email-templates/booking.confirm')
        .send({ subject: 'Solo asunto' })
        .expect(400);

      await request(app)
        .put('/api/admin/email-templates/booking.confirm')
        .send({ html_template: '<p>Solo html</p>' })
        .expect(400);
    });

    it('acepta plantilla sin variables (texto plano)', async () => {
      const updatedRow = {
        key: 'account.approved',
        name: 'Cuenta Aprobada',
        subject: 'Cuenta aprobada',
        html_template: '<p>Tu cuenta fue aprobada.</p>',
        updated_at: '2026-08-21T12:00:00Z',
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [updatedRow] })
        .mockResolvedValueOnce({ rows: [updatedRow] });

      const res = await request(app)
        .put('/api/admin/email-templates/account.approved')
        .send({
          subject: 'Cuenta aprobada',
          html_template: '<p>Tu cuenta fue aprobada.</p>',
        })
        .expect(200);

      expect(res.body.subject).toBe('Cuenta aprobada');
    });
  });

  // ─── Protección con middleware ───
  describe('Middleware de auth', () => {
    it('requiere autenticación (protect) en GET', async () => {
      mockProtect.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: 'No autorizado, no hay token.' })
      );
      await request(app).get('/api/admin/email-templates').expect(401);
    });

    it('requiere rol admin en PUT', async () => {
      mockIsAdmin.mockImplementationOnce((req, res) =>
        res.status(403).json({ message: 'Acceso denegado.' })
      );
      await request(app)
        .put('/api/admin/email-templates/booking.confirm')
        .send({ subject: 'x', html_template: '<p>x</p>' })
        .expect(403);
    });
  });
});
