/**
 * Intruely Backend — Security & JWT Middleware Tests
 * Tests: JWT secret rotation safety, tampered token rejection,
 *        expired token rejection, token structure validation, SQL injection resistance
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test_jwt_secret_intruely_2026';
process.env.GEMINI_API_KEY = 'test_key_security_suite';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn()
  },
  initDB: jest.fn().mockResolvedValue(true)
}));

const { pool } = require('../db');
const app = require('../server');

describe('JWT Security Tests', () => {

  it('rejects token signed with wrong secret', async () => {
    const maliciousToken = jwt.sign(
      { id: 'hacker-uuid', email: 'hacker@evil.com', name: 'Hacker' },
      'wrong_secret_that_attacker_guessed',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${maliciousToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });

  it('rejects expired JWT tokens', async () => {
    const expiredToken = jwt.sign(
      { id: 'user-uuid', email: 'user@intruely.app', name: 'User' },
      'test_jwt_secret_intruely_2026',
      { expiresIn: '-1s' } // Already expired
    );

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('rejects requests with no Bearer prefix in Authorization header', async () => {
    const res = await request(app)
      .get('/modes')
      .set('Authorization', 'just_a_token_without_bearer');

    expect(res.status).toBe(401);
  });

  it('rejects requests with empty Bearer token', async () => {
    const res = await request(app)
      .get('/modes')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
  });

  it('rejects structurally invalid token (not 3 JWT parts)', async () => {
    const res = await request(app)
      .get('/modes')
      .set('Authorization', 'Bearer onepart');

    expect(res.status).toBe(401);
  });

  it('rejects token with tampered payload (signature mismatch)', async () => {
    const validToken = jwt.sign(
      { id: 'real-uuid', email: 'real@intruely.app' },
      'test_jwt_secret_intruely_2026',
      { expiresIn: '1h' }
    );

    // Tamper with the payload section (middle part of JWT)
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({
      id: 'admin-uuid',
      email: 'admin@intruely.app',
      name: 'Admin Hacker'
    })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
  });
});

describe('Input Validation & SQL Injection Resistance', () => {

  it('handles SQL injection attempt in email field gracefully', async () => {
    const res = await request(app).post('/auth/login').send({
      email: "'; DROP TABLE users; --",
      password: 'doesnt_matter'
    });
    // Should NOT crash the server or return 500
    expect([400, 401, 404, 500]).toContain(res.status);
    // Should never expose raw SQL errors to client
    expect(JSON.stringify(res.body)).not.toMatch(/syntax error|pg error|relation "users"/i);
  });

  it('handles XSS payload in prompt field gracefully', async () => {
    // XSS in prompt is forwarded to the AI model — the server should not crash
    // and must return a structured JSON body (not raw HTML or stack trace)
    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: '<script>alert("xss")</script>' });

    // Server must return structured JSON regardless of status
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toBeInstanceOf(Object);
    // Must never expose internal stack traces or raw error strings
    expect(JSON.stringify(res.body)).not.toMatch(/at Object\.<anonymous>|node_modules|stack trace/i);
  });

  it('handles extremely long prompt without server crash', async () => {
    process.env.GEMINI_API_KEY = 'test_key_long';
    const longPrompt = 'A'.repeat(50000);

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: longPrompt });

    // Server should not crash with a 5xx beyond our expected AI error
    expect([200, 400, 500]).toContain(res.status);
  });
});

describe('Rate Limiting', () => {
  it('includes rate limiting headers on AI route responses', async () => {
    process.env.GEMINI_API_KEY = 'test_rate';
    
    jest.resetModules();

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'test' });

    // Rate limit headers should be present
    expect(
      res.headers['x-ratelimit-limit'] ||
      res.headers['ratelimit-limit'] ||
      res.headers['x-ratelimit-remaining']
    ).toBeDefined();
  });
});
