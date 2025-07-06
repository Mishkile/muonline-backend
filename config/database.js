const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'muonline',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('⚠️  Server will start without database. Configure remote access to enable database features.');
    return false;
  }
};

// Initialize connection test (non-blocking)
testConnection();

module.exports = {
  pool,
  
  // Execute query with error handling
  async query(sql, params = []) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  // Get single row
  async queryOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  },

  // Start transaction
  async getConnection() {
    return await pool.getConnection();
  }
};
