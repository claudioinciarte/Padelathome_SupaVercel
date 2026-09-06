const jwt = require('jsonwebtoken');
const { protect, isAdmin } = require('./authMiddleware');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('custom JWT middleware', () => {
  it('accepts the Supabase-compatible JWT and preserves the application role', () => {
    const req = {
      headers: {
        authorization: `Bearer ${jwt.sign({
          sub: '7',
          user_id: 7,
          role: 'authenticated',
          app_role: 'admin',
        }, process.env.JWT_SECRET)}`,
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 7, user_id: 7, role: 'authenticated', app_role: 'admin' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('authorizes admin using app_role instead of the Supabase role claim', () => {
    const req = { user: { role: 'authenticated', app_role: 'admin' } };
    const res = makeResponse();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a token signed with a different secret', () => {
    const req = {
      headers: {
        authorization: `Bearer ${jwt.sign({ sub: '7', role: 'authenticated' }, 'wrong-secret')}`,
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});