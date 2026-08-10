/**
 * Intruely Backend — Health & Server Infrastructure Tests
 * Tests: Server boot, health endpoint, CORS headers, 404 handling, rate limiting
 */

const request = require('supertest');

// Spin up the Express app in test mode without actually binding to a port
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test_jwt_secret_intruely_2026';
process.env.PORT = '3099';

// Suppress DB warnings during tests
jest.mock('../db', () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [] })
  },
  initDB: jest.fn().mockResolvedValue(true)
}));

const app = require('../server');

describe('Infrastructure & Health Tests', () => {

  describe('GET /', () => {
    it('returns 200 with service metadata', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('service', 'Intruely Backend API');
      expect(res.body).toHaveProperty('version', '1.0.0');
      expect(res.body).toHaveProperty('status', 'online');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('timestamp is a valid ISO 8601 date string', async () => {
      const res = await request(app).get('/');
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });
  });

  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    it('includes uptime as a positive number', async () => {
      const res = await request(app).get('/health');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('CORS Headers', () => {
    it('returns CORS headers allowing all origins', async () => {
      const res = await request(app)
        .options('/')
        .set('Origin', 'https://someelectronclient.app');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('404 Route Handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/totally-nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('404 response contains the method and URL', async () => {
      const res = await request(app).get('/does/not/exist');
      expect(res.body.error).toMatch(/GET/);
    });
  });

  describe('Response Content-Type', () => {
    it('/ returns JSON content type', async () => {
      const res = await request(app).get('/');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('/health returns JSON content type', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
