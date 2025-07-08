const db = require('./config/database');

async function testQueries() {
  try {
    console.log('Testing dashboard stats queries...');
    
    // Test each query individually
    const queries = [
      'SELECT COUNT(*) as total FROM accounts',
      'SELECT COUNT(*) as total FROM character_info', 
      'SELECT COUNT(*) as total FROM character_info WHERE online = 1',
      'SELECT COUNT(*) as total FROM news WHERE status = "published"'
    ];
    
    for (let i = 0; i < queries.length; i++) {
      try {
        const result = await db.query(queries[i]);
        console.log(`Query ${i+1}: ${queries[i]}`);
        console.log('Result:', result);
        console.log('Total:', result[0]?.total || 'undefined');
        console.log('---');
      } catch (error) {
        console.log(`Query ${i+1} ERROR: ${queries[i]}`);
        console.log('Error:', error.message);
        console.log('---');
      }
    }
    
    // Test recent registrations query
    console.log('Testing recent registrations query...');
    try {
      const recentQuery = `
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM accounts 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      const recentResult = await db.query(recentQuery);
      console.log('Recent registrations result:', recentResult);
    } catch (error) {
      console.log('Recent registrations ERROR:', error.message);
    }
    
    // Test top characters query
    console.log('Testing top characters query...');
    try {
      const topQuery = `
        SELECT name as character_name, level as character_level, race as character_class
        FROM character_info 
        ORDER BY level DESC 
        LIMIT 10
      `;
      const topResult = await db.query(topQuery);
      console.log('Top characters result:', topResult);
    } catch (error) {
      console.log('Top characters ERROR:', error.message);
    }
    
    // Check what tables actually exist
    console.log('\nChecking available tables...');
    try {
      const tablesResult = await db.query('SHOW TABLES');
      console.log('Available tables:', tablesResult.map(row => Object.values(row)[0]));
    } catch (error) {
      console.log('Tables check ERROR:', error.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

testQueries();
