const mysql = require('mysql2/promise');
require('dotenv').config();

const setupAdminAccess = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database...');

    // Check existing accounts
    const accountsQuery = 'SELECT guid, account, web_admin, gm_level FROM accounts ORDER BY guid LIMIT 10';
    const [accounts] = await connection.execute(accountsQuery);
    
    console.log('\n📋 Current accounts:');
    console.table(accounts);

    // Set admin privileges for the admin3 account (or first account if admin3 doesn't exist)
    let targetAccount = accounts.find(acc => acc.account === 'admin3') || accounts[0];
    
    if (targetAccount) {
      const updateQuery = `
        UPDATE accounts 
        SET web_admin = 2, gm_level = 3
        WHERE guid = ?
      `;
      await connection.execute(updateQuery, [targetAccount.guid]);
      
      console.log(`\n✅ Admin privileges granted to account: ${targetAccount.account}`);
      console.log('   - web_admin: 2');
      console.log('   - gm_level: 3');

      // Verify the update
      const verifyQuery = 'SELECT guid, account, web_admin, gm_level FROM accounts WHERE guid = ?';
      const [updated] = await connection.execute(verifyQuery, [targetAccount.guid]);
      console.log('\n📋 Updated account:');
      console.table(updated);
    } else {
      console.log('❌ No accounts found to update');
    }

    await connection.end();
    console.log('\n✅ Admin setup completed!');
  } catch (error) {
    console.error('❌ Error setting up admin access:', error);
  }
};

setupAdminAccess();
