/**
 * Intruely Backend — Advanced AI Route & Persona Tests
 * Tests: System prompt rules, variation handling, image-only query processing,
 *        custom mode injection, and error diagnostics
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test_jwt_secret_intruely_2026';
process.env.GEMINI_API_KEY = 'test_gemini_key_module_load';

jest.mock('../db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn()
  },
  initDB: jest.fn().mockResolvedValue(true)
}));

jest.mock('node-fetch', () => jest.fn());

const request = require('supertest');
const fetch = require('node-fetch');
const app = require('../server');

beforeEach(() => {
  fetch.mockReset();
  process.env.GEMINI_API_KEY = 'test_gemini_key_default';
});

describe('POST /ai/ask — Public Access & Core Functionality', () => {

  it('is accessible without any Authorization header', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test AI response.' }] } }]
      })
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'What is 2+2?' });

    expect(res.status).toBe(200);
  });

  it('rejects request when both prompt and imageBase64 are missing', async () => {
    const res = await request(app).post('/ai/ask').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt or image/i);
  });

  it('handles image-only query without prompt text', async () => {
    let capturedBody = null;
    fetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Solved image question.' }] } }]
        })
      };
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({ imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==' });

    expect(res.status).toBe(200);
    expect(capturedBody.contents[0].parts[0].text).toContain('Analyze the attached image');
  });

  it('enforces STAR method framework in default system context', async () => {
    let capturedBody = null;
    fetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'STAR method response.' }] } }]
        })
      };
    });

    await request(app)
      .post('/ai/ask')
      .send({ prompt: 'Tell me about a time you resolved a critical production incident.' });

    const promptText = capturedBody.contents[0].parts[0].text;
    expect(promptText).toContain('STAR Method Enforcement');
    expect(promptText).toContain('Situation');
    expect(promptText).toContain('Action');
    expect(promptText).toContain('Result');
  });


  it('injects custom modePrompt override cleanly', async () => {
    let capturedBody = null;
    fetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Custom mode response.' }] } }]
        })
      };
    });

    await request(app)
      .post('/ai/ask')
      .send({
        prompt: 'Explain my resume',
        modePrompt: 'Role: Senior Staff Architect. Focus on Distributed Systems.'
      });

    expect(capturedBody.contents[0].parts[0].text).toContain('Senior Staff Architect');
  });

  it('strips data URL prefix from vision base64 input', async () => {
    let capturedBody = null;
    fetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Vision response.' }] } }]
        })
      };
    });

    await request(app)
      .post('/ai/ask')
      .send({
        prompt: 'Analyze diagram',
        imageBase64: 'data:image/jpeg;base64,ABCDEF123456789'
      });

    const inlineData = capturedBody.contents[0].parts[1].inline_data;
    expect(inlineData.data).toBe('ABCDEF123456789');
  });

  it('returns structured 500 error when Gemini API returns an upstream error object', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        error: { message: 'Quota exceeded for project' }
      })
    });

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'Test quota limit' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Gemini API Error: Quota exceeded for project');
  });

  it('returns structured 500 error when no API key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_PRIMARY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    delete process.env.GEMINI_API_KEY_BACKUP2;

    const res = await request(app)
      .post('/ai/ask')
      .send({ prompt: 'Hello?' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/API Key is missing/i);
  });
});
