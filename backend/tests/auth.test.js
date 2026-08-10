/**
 * Intruely Backend — Authentication Route Tests
 * Tests: Signup validation, login validation, JWT token integrity,
 *        duplicate email rejection, password hashing, token verification
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test_jwt_secret_intruely_2026';

const TEST_JWT_SECRET = 'test_jwt_secret_intruely_2026';

// Mock PostgreSQL pool so tests run without a real database
let userStore = {};

jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  },
  initDB: jest.fn().mockResolvedValue(true)
}));

const { pool } = require('../db');
const app = require('../server');

beforeEach(() => {
  userStore = {};
  pool.query.mockReset();
});

describe('POST /auth/signup', () => {

  it('rejects request with missing fields', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects weak passwords shorter than 6 characters', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: 'test@intruely.app',
      password: '123'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('rejects duplicate email address', async () => {
    // Simulate existing user in DB
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'existing-uuid' }] }); // SELECT check

    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: 'existing@intruely.app',
      password: 'secure_password_123'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('creates new user and returns JWT token on valid signup', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // No existing user
      .mockResolvedValueOnce({             // User created
        rows: [{
          id: 'new-test-uuid',
          name: 'Shriya Nayyar',
          email: 'shriya@intruely.app',
          avatar_initials: 'SN',
          created_at: new Date().toISOString()
        }]
      })
      .mockResolvedValueOnce({ rows: [] }); // Default mode created

    const res = await request(app).post('/auth/signup').send({
      name: 'Shriya Nayyar',
      email: 'shriya@intruely.app',
      password: 'secure_pass_456'
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('shriya@intruely.app');
    expect(res.body.user.avatar).toBe('SN');
  });

  it('returned JWT is verifiable and contains correct user payload', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'jwt-test-uuid',
          name: 'JWT Tester',
          email: 'jwt@intruely.app',
          avatar_initials: 'JT',
          created_at: new Date().toISOString()
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/auth/signup').send({
      name: 'JWT Tester',
      email: 'jwt@intruely.app',
      password: 'jwt_test_password'
    });

    const decoded = jwt.verify(res.body.token, TEST_JWT_SECRET);
    expect(decoded).toHaveProperty('id', 'jwt-test-uuid');
    expect(decoded).toHaveProperty('email', 'jwt@intruely.app');
  });
});

describe('POST /auth/login', () => {

  it('rejects request with missing credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'user@test.com' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects login for email that does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/auth/login').send({
      email: 'ghost@intruely.app',
      password: 'doesnt_matter'
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no account/i);
  });

  it('rejects login with incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct_password', 12);
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'test-uuid',
        name: 'Real User',
        email: 'real@intruely.app',
        password_hash: passwordHash,
        avatar_initials: 'RU'
      }]
    });

    const res = await request(app).post('/auth/login').send({
      email: 'real@intruely.app',
      password: 'wrong_password'
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect password/i);
  });

  it('returns valid JWT token on successful login', async () => {
    const passwordHash = await bcrypt.hash('correct_password_789', 12);
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'login-test-uuid',
        name: 'Login Tester',
        email: 'login@intruely.app',
        password_hash: passwordHash,
        avatar_initials: 'LT'
      }]
    });

    const res = await request(app).post('/auth/login').send({
      email: 'login@intruely.app',
      password: 'correct_password_789'
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');

    const decoded = jwt.verify(res.body.token, TEST_JWT_SECRET);
    expect(decoded.email).toBe('login@intruely.app');
  });
});

describe('GET /auth/me', () => {

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  it('returns 401 with malformed Bearer token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer totally.invalid.token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });

  it('returns user profile with valid JWT token', async () => {
    const token = jwt.sign(
      { id: 'profile-uuid', email: 'me@intruely.app', name: 'Profile User' },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );

    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'profile-uuid',
        name: 'Profile User',
        email: 'me@intruely.app',
        avatar_initials: 'PU'
      }]
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@intruely.app');
  });
});
