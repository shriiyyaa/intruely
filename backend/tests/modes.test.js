/**
 * Intruely Backend — Manage Modes Route Tests
 * Tests: Auth guard, fetch modes, create mode, update mode, activate mode,
 *        delete mode, ownership isolation, edge cases
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test_jwt_secret_intruely_2026';

const JWT_SECRET = 'test_jwt_secret_intruely_2026';

jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  },
  initDB: jest.fn().mockResolvedValue(true)
}));

const { pool } = require('../db');
const app = require('../server');

// Helper to generate a test JWT token
function makeToken(userId = 'test-user-uuid', email = 'test@intruely.app') {
  return jwt.sign({ id: userId, email, name: 'Test User' }, JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /modes — Authentication Guard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/modes');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/modes')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('GET /modes — Fetch User Modes', () => {
  it('returns all modes for the authenticated user', async () => {
    const token = makeToken();
    const mockModes = [
      { id: 'mode-1', name: 'General', prompt: 'Be helpful', is_active: true, updated_at: new Date() },
      { id: 'mode-2', name: 'Interview Prep', prompt: 'Candidate context', is_active: false, updated_at: new Date() }
    ];

    pool.query.mockResolvedValueOnce({ rows: mockModes });

    const res = await request(app)
      .get('/modes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('modes');
    expect(res.body.modes).toHaveLength(2);
    expect(res.body.modes[0].name).toBe('General');
  });

  it('returns empty array when user has no modes', async () => {
    const token = makeToken();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/modes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.modes).toHaveLength(0);
  });
});

describe('POST /modes — Create Mode', () => {
  it('creates a new mode and returns it', async () => {
    const token = makeToken();
    const newMode = {
      id: 'new-mode-uuid',
      name: 'New Mode',
      prompt: 'This is my context',
      is_active: false,
      user_id: 'test-user-uuid',
      updated_at: new Date()
    };

    pool.query.mockResolvedValueOnce({ rows: [newMode] });

    const res = await request(app)
      .post('/modes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Mode', prompt: 'This is my context' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('mode');
    expect(res.body.mode.name).toBe('New Mode');
  });

  it('creates mode with default name when name is omitted', async () => {
    const token = makeToken();
    const newMode = { id: 'mode-default', name: 'Untitled Mode', prompt: '', is_active: false };

    pool.query.mockResolvedValueOnce({ rows: [newMode] });

    const res = await request(app)
      .post('/modes')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.mode.name).toBe('Untitled Mode');
  });
});

describe('PUT /modes/:id — Update Mode', () => {
  it('updates mode name and prompt', async () => {
    const token = makeToken();
    const updatedMode = { id: 'mode-1', name: 'Updated Name', prompt: 'New prompt', is_active: false };

    pool.query.mockResolvedValueOnce({ rows: [updatedMode] });

    const res = await request(app)
      .put('/modes/mode-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', prompt: 'New prompt' });

    expect(res.status).toBe(200);
    expect(res.body.mode.name).toBe('Updated Name');
  });

  it('deactivates all other modes when activating one (single-active invariant)', async () => {
    const token = makeToken();
    const activated = { id: 'mode-2', name: 'Interview Mode', prompt: 'Context', is_active: true };

    // First call: deactivate all, Second call: activate the specific mode
    pool.query
      .mockResolvedValueOnce({ rows: [] })   // UPDATE SET is_active=false for all
      .mockResolvedValueOnce({ rows: [activated] }); // UPDATE SET is_active=true for mode-2

    const res = await request(app)
      .put('/modes/mode-2')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.mode.is_active).toBe(true);
    // Two queries must have been called
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns 404 when updating a mode not owned by the user', async () => {
    const token = makeToken();
    pool.query.mockResolvedValueOnce({ rows: [] }); // No match for id + user_id combo

    const res = await request(app)
      .put('/modes/nonexistent-mode')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('DELETE /modes/:id — Delete Mode', () => {
  it('deletes a mode and returns success message', async () => {
    const token = makeToken();
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .delete('/modes/mode-to-delete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('only deletes mode belonging to the authenticated user', async () => {
    const token = makeToken('user-a');
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await request(app)
      .delete('/modes/some-mode-id')
      .set('Authorization', `Bearer ${token}`);

    // Check that user_id was included in the DELETE WHERE clause
    const queryCall = pool.query.mock.calls[0];
    expect(queryCall[1]).toContain('user-a');
  });
});
