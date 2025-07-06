require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTableStructure() {
  console.log('🔍 Checking Database Table Structure...');
  console.log('======================================');
  
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'muonline',
    connectTimeout: 10000
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');

    // Check accounts table structure
    console.log('\n📋 Accounts table structure:');
    const [columns] = await connection.execute('DESCRIBE accounts');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''}`);
    });

    // Check for username-like columns
    console.log('\n🔍 Looking for username/login columns...');
    const usernameColumns = columns.filter(col => 
      col.Field.toLowerCase().includes('user') || 
      col.Field.toLowerCase().includes('login') || 
      col.Field.toLowerCase().includes('name') ||
      col.Field.toLowerCase().includes('account')
    );
    
    if (usernameColumns.length > 0) {
      console.log('Found potential username columns:');
      usernameColumns.forEach(col => {
        console.log(`  ✓ ${col.Field}`);
      });
    }

    // Sample data from accounts
    console.log('\n📊 Sample accounts data:');
    const [sampleRows] = await connection.execute('SELECT * FROM accounts LIMIT 3');
    if (sampleRows.length > 0) {
      console.log('Columns in accounts table:', Object.keys(sampleRows[0]));
      sampleRows.forEach((row, index) => {
        console.log(`Account ${index + 1}:`, row);
      });
    }

    await connection.end();
    console.log('\n✅ Table structure analysis complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableStructure();
