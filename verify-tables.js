const mysql = require('mysql2/promise');
require('dotenv').config();

const verifyTables = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database...');

    // Check admin_actions table structure
    console.log('\n📋 Admin Actions table structure:');
    const [adminActionsStructure] = await connection.execute('DESCRIBE admin_actions');
    console.table(adminActionsStructure);

    // Check events table structure
    console.log('\n📋 Events table structure:');
    const [eventsStructure] = await connection.execute('DESCRIBE events');
    console.table(eventsStructure);

    // Check news table structure
    console.log('\n📋 News table structure:');
    const [newsStructure] = await connection.execute('DESCRIBE news');
    console.table(newsStructure);

    // Check foreign key constraints
    const foreignKeyQuery = `
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
      AND REFERENCED_TABLE_NAME IS NOT NULL
      AND TABLE_NAME IN ('admin_actions', 'events')
    `;
    const [foreignKeys] = await connection.execute(foreignKeyQuery, [process.env.DB_NAME]);
    
    console.log('\n🔗 Foreign key constraints:');
    console.table(foreignKeys);

    // Check if sample news exists
    const newsCountQuery = 'SELECT COUNT(*) as count FROM news';
    const [newsCount] = await connection.execute(newsCountQuery);
    console.log(`\n📰 News articles: ${newsCount[0].count}`);

    await connection.end();
    console.log('\n✅ Table verification completed successfully!');
  } catch (error) {
    console.error('❌ Error verifying tables:', error);
  }
};

verifyTables();
