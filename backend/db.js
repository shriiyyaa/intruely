const { Pool } = require('pg');

// Support both Railway's DATABASE_URL and individual vars
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'intruely',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      }
);

async function initDB() {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_initials TEXT DEFAULT 'U',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Modes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS modes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Untitled Mode',
        prompt TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Sessions table (for history/recap)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled Session',
        messages JSONB DEFAULT '[]',
        duration_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // AI usage tracker
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        request_type TEXT DEFAULT 'text',
        tokens_used INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('✅ Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
