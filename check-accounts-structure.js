const mysql = require('mysql2/promise');
require('dotenv').config();

const checkAccountsStructure = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database...');

    // Check accounts table structure
    const accountsStructureQuery = `DESCRIBE accounts`;
    const [accountsStructure] = await connection.execute(accountsStructureQuery);
    
    console.log('\n📋 Accounts table structure:');
    console.table(accountsStructure);

    // Check primary key
    const primaryKeyQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'accounts' 
      AND COLUMN_KEY = 'PRI'
    `;
    const [primaryKey] = await connection.execute(primaryKeyQuery, [process.env.DB_NAME]);
    
    console.log('\n🔑 Primary key information:');
    console.table(primaryKey);

    // Check if there are any existing foreign key constraints referencing accounts
    const foreignKeyQuery = `
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_SCHEMA = ? 
      AND REFERENCED_TABLE_NAME = 'accounts'
    `;
    const [foreignKeys] = await connection.execute(foreignKeyQuery, [process.env.DB_NAME]);
    
    console.log('\n🔗 Existing foreign keys referencing accounts:');
    console.table(foreignKeys);

    await connection.end();
  } catch (error) {
    console.error('❌ Error checking accounts structure:', error);
  }
};

checkAccountsStructure();
