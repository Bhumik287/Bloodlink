/**
 * MongoDB Connection Module
 * Course Reference: Unit-4 Database Integration (MongoDB via native MongoClient)
 * Reuses a single client connection pool across the application.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'bloodlink_db';

let client = null;
let db = null;

/**
 * Connect to MongoDB and return the database instance
 */
async function connectDB() {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log(`[Database] Successfully connected to MongoDB database: "${dbName}"`);
    return db;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB at "${uri}":`, error.message);
    throw error;
  }
}

/**
 * Get active database instance
 */
function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() during application startup.');
  }
  return db;
}

/**
 * Close database connection cleanly on shutdown
 */
async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Database] Connection closed cleanly.');
  }
}

module.exports = {
  connectDB,
  getDB,
  closeDB
};
