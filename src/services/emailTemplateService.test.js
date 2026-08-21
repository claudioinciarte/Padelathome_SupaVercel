/**
 * Test unitario de emailTemplateService.
 * Verifica: sustitución de {{variable}}, validación contra CONTEXT_VARS,
 * fallback a defaults cuando la DB no está disponible, y manejo de claves
 * desconocidas.
 */
const emailTemplateService = require('../services/emailTemplateService');

// Mock del pool de database — simula que la tabla está vacía (fuerza fallback)
jest.mock('../config/database', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  return { query: mockQuery, __mockQuery: mockQuery };
});
const mockDb = require('../config/database');

const {
  renderTemplate,
  getTemplate,
  listTemplates,
  validateTemplateVars,
  substituteVars,
  extractVars,
  CONTEXT_VARS,
  DEFAULT_TEMPLATES,
} = emailTemplateService;

describe('emailTemplateService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('substituteVars', () => {
    it('sustituye {{variable}} por el valor del contexto', () => {
      const result = substituteVars('Hola {{name}}, tu cita es el {{date}}', {
        name: 'Jose',
        date: '21/08/2026',
      });
      expect(result).toBe('Hola Jose, tu cita es el 21/08/2026');
    });

    it('no evalúa JS ni HTML — solo reemplazo de texto', () => {
      const malicious = '{{x}}';
      const result = substituteVars(malicious, { x: '<script>alert(1)</script>' });
      expect(result).toBe('<script>alert(1)</script>');
      // El script queda como texto literal; nodemailer lo envía pero el motor
      // nunca lo ejecuta. La responsabilidad de escapar es del HTML del email.
    });

    it('deja {{variable}} sin sustituir si no está en el contexto', () => {
      const result = substituteVars('Hola {{name}}', {});
      expect(result).toBe('Hola {{name}}');
    });

    it('maneja null/undefined como cadena vacía', () => {
      const result = substituteVars('Hola {{name}}', { name: null });
      expect(result).toBe('Hola ');
    });
  });

  describe('extractVars', () => {
    it('extrae nombres de variables de un texto', () => {
      expect(extractVars('{{name}} y {{date}}')).toEqual(['name', 'date']);
    });

    it('devuelve array vacío si no hay variables', () => {
      expect(extractVars('sin variables')).toEqual([]);
    });
  });

  describe('validateTemplateVars', () => {
    it('acepta variables que están en CONTEXT_VARS', () => {
      const result = validateTemplateVars('booking.confirm', 'Reserva {{date}}', 'Hola {{userName}}');
      expect(result.ok).toBe(true);
      expect(result.unknown).toEqual([]);
    });

    it('rechaza variables que no están en CONTEXT_VARS', () => {
      const result = validateTemplateVars('booking.confirm', 'Hola {{maliciosa}}', '');
      expect(result.ok).toBe(false);
      expect(result.unknown).toContain('maliciosa');
    });
  });

  describe('renderTemplate', () => {
    it('renderiza booking.confirm con todas las variables', async () => {
      const result = await renderTemplate('booking.confirm', {
        userName: 'Jose',
        date: '21/08/2026',
      });
      expect(result.subject).toBe('Confirmación de Reserva en Padel@Home para el 21/08/2026');
      expect(result.html).toContain('¡Hola, Jose!');
      expect(result.html).toContain('Tu reserva ha sido confirmada');
      expect(result.name).toBe('Confirmación de Reserva');
    });

    it('renderiza waitlist.slot con URL de confirmación', async () => {
      const result = await renderTemplate('waitlist.slot', {
        userName: 'Ana',
        slotTime: '22/08/2026 18:00',
        confirmationUrl: 'https://padel.example.com/confirm?token=abc',
      });
      expect(result.html).toContain('¡Hola, Ana!');
      expect(result.html).toContain('22/08/2026 18:00');
      expect(result.html).toContain('https://padel.example.com/confirm?token=abc');
    });

    it('renderiza match.cancel con motivo', async () => {
      const result = await renderTemplate('match.cancel', {
        userName: 'Carlos',
        formattedDate: '23/08/2026 10:00',
        cancelReason: 'Un jugador abandonó la partida.',
      });
      expect(result.html).toContain('Hola Carlos');
      expect(result.html).toContain('23/08/2026 10:00');
      expect(result.html).toContain('Un jugador abandonó la partida.');
    });

    it('cae al default si la DB no tiene la plantilla (mock rows=[])', async () => {
      const result = await renderTemplate('account.approved', { userName: 'Luis' });
      expect(result.html).toContain('¡Hola, Luis!');
      expect(result.html).toContain('Tu cuenta ha sido aprobada');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('lanza error si la clave no existe en el catálogo', async () => {
      await expect(renderTemplate('clave.inexistente', {})).rejects.toThrow('Plantilla desconocida');
    });

    it('lanza error si la plantilla (leída de DB) usa variables no válidas', async () => {
      // Simular que la DB devuelve una plantilla con una variable no declarada
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          name: 'Test',
          subject: 'Hola {{bannedVar}}',
          html_template: '<p>{{bannedVar}}</p>',
        }],
      });
      await expect(renderTemplate('booking.confirm', { userName: 'x', date: 'y' }))
        .rejects.toThrow('Variables no válidas');
    });

    it('renderiza account.welcome con setPasswordUrl', async () => {
      const result = await renderTemplate('account.welcome', {
        userName: 'Marta',
        setPasswordUrl: 'https://padel.example.com/reset?token=xyz',
      });
      expect(result.html).toContain('Hola, Marta');
      expect(result.html).toContain('https://padel.example.com/reset?token=xyz');
    });

    it('renderiza password.reset con setPasswordUrl', async () => {
      const result = await renderTemplate('password.reset', {
        userName: 'Pedro',
        setPasswordUrl: 'https://padel.example.com/reset?token=123',
      });
      expect(result.html).toContain('Hola, Pedro');
      expect(result.html).toContain('https://padel.example.com/reset?token=123');
    });

    it('renderiza auth.password-reset con resetUrl', async () => {
      const result = await renderTemplate('auth.password-reset', {
        userName: 'Eva',
        resetUrl: 'https://padel.example.com/reset?token=abc',
      });
      expect(result.html).toContain('Hola, Eva');
      expect(result.html).toContain('https://padel.example.com/reset?token=abc');
      expect(result.subject).toContain('Restablece tu contraseña');
    });
  });

  describe('getTemplate', () => {
    it('devuelve el default si la DB no tiene la fila', async () => {
      const tpl = await getTemplate('booking.confirm');
      expect(tpl.name).toBe('Confirmación de Reserva');
      expect(tpl.subject).toContain('{{date}}');
    });

    it('devuelve null para una clave inexistente', async () => {
      const tpl = await getTemplate('no.existe');
      expect(tpl).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('devuelve las 7 plantillas (fallback si DB vacía)', async () => {
      const list = await listTemplates();
      expect(list).toHaveLength(7);
      const keys = list.map(t => t.key).sort();
      expect(keys).toEqual([
        'account.approved',
        'account.welcome',
        'auth.password-reset',
        'booking.confirm',
        'match.cancel',
        'password.reset',
        'waitlist.slot',
      ]);
    });

    it('devuelve los datos de la DB si hay filas', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          key: 'booking.confirm',
          name: 'Nombre DB',
          subject: 'Asunto DB',
          html_template: '<p>HTML DB</p>',
          updated_at: '2026-08-21T10:00:00Z',
        }],
      });
      const list = await listTemplates();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Nombre DB');
      expect(list[0].updated_at).toBe('2026-08-21T10:00:00Z');
    });
  });

  describe('CONTEXT_VARS', () => {
    it('tiene las 7 claves', () => {
      expect(Object.keys(CONTEXT_VARS)).toHaveLength(7);
    });

    it('define las variables correctas para booking.confirm', () => {
      expect(CONTEXT_VARS['booking.confirm']).toEqual(['userName', 'date']);
    });

    it('define las variables correctas para waitlist.slot', () => {
      expect(CONTEXT_VARS['waitlist.slot']).toEqual(['userName', 'slotTime', 'confirmationUrl']);
    });
  });
});
