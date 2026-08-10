/**
 * Intruely Backend — AI Proxy Route Tests
 * Tests: Public access, empty body rejection, backend proxy behavior,
 *        vision base64 stripping, Gemini API key fallback, error handling
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test_jwt_secret_intruely_2026';
process.env.GEMINI_API_KEY = 'test_gemini_key_module_load';

// Mock the pg pool so tests run without a real database
jest.mock('../db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn()
  },
  initDB: jest.fn().mockResolvedValue(true)
}));

// Mock node-fetch globally — must be before any require of app/server
jest.mock('node-fetch', () => jest.fn());

const request = require('supertest');
const fetch = require('node-fetch');
const app = require('../server');

beforeEach(() => {
  fetch.mockReset();
  process.env.GEMINI_API_KEY = 'test_gemini_key_default';
});

describe('POST /ai/ask — Public Access', () => {

  it('is accessible without any Authorization header (public proxy route)', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test AI response from Gemini.' }] } }]
      })
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'What is 2+2?' });

    // Should not return 401 — route is public
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('rejects request when both prompt and imageBase64 are missing', async () => {
    const res = await request(app)
      .post('/ai/ask')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/prompt or image/i);
  });

  it('returns AI response for a valid text prompt', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'Two plus two is four.' }]
          }
        }]
      })
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'What is 2+2?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('response');
    expect(res.body.response).toBe('Two plus two is four.');
  });

  it('injects modePrompt into the Gemini system context correctly', async () => {
    let capturedBody = null;

    fetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Mode-aware response.' }] } }]
        })
      };
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({
        prompt: 'Tell me about myself',
        modePrompt: 'I am a senior software engineer applying for a staff role.'
      });

    expect(res.status).toBe(200);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.contents[0].parts[0].text).toContain('senior software engineer');
  });

  it('strips data URL prefix from base64 image before sending to Gemini', async () => {
    let capturedBody = null;

    fetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'I see a coding question.' }] } }]
        })
      };
    });

    const fakeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'Solve this question', imageBase64: fakeBase64 });

    expect(res.status).toBe(200);
    expect(capturedBody).not.toBeNull();

    const inlineData = capturedBody.contents[0].parts[1]?.inline_data;
    expect(inlineData).toBeDefined();
    // Must NOT have the data URL prefix
    expect(inlineData.data).not.toMatch(/^data:image/);
    expect(inlineData.mime_type).toBe('image/png');
  });

  it('returns 500 when Gemini API returns no candidates', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ candidates: [] })
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'What is 2+2?' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 500 when AI API key is not configured on backend', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_PRIMARY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    delete process.env.GEMINI_API_KEY_BACKUP2;

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'Hello?' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/API Key/i);
  });

  it('handles fetch() network error gracefully without crashing', async () => {
    fetch.mockRejectedValueOnce(new Error('Network timeout'));

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'What is AI?' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
