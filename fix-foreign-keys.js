const mysql = require('mysql2/promise');
require('dotenv').config();

const fixForeignKeys = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database...');

    // Check current column types
    const accountsGuidQuery = `
      SELECT DATA_TYPE, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'accounts' 
      AND COLUMN_NAME = 'guid'
    `;
    const [accountsGuid] = await connection.execute(accountsGuidQuery, [process.env.DB_NAME]);
    console.log('\n🔍 Accounts.guid column type:', accountsGuid[0]);

    const adminActionsAdminIdQuery = `
      SELECT DATA_TYPE, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'admin_actions' 
      AND COLUMN_NAME = 'admin_id'
    `;
    const [adminActionsAdminId] = await connection.execute(adminActionsAdminIdQuery, [process.env.DB_NAME]);
    console.log('🔍 Admin_actions.admin_id column type:', adminActionsAdminId[0]);

    // Fix the admin_actions admin_id column type to match accounts.guid
    console.log('\n🔧 Fixing admin_actions.admin_id column type...');
    await connection.execute('ALTER TABLE admin_actions MODIFY admin_id INT(10) UNSIGNED NOT NULL');

    // Fix the events created_by column type to match accounts.guid
    console.log('🔧 Fixing events.created_by column type...');
    await connection.execute('ALTER TABLE events MODIFY created_by INT(10) UNSIGNED');

    // Now add the foreign key constraints
    console.log('🔧 Adding foreign key constraints...');
    
    try {
      await connection.execute(`
        ALTER TABLE admin_actions 
        ADD CONSTRAINT fk_admin_actions_account 
        FOREIGN KEY (admin_id) REFERENCES accounts(guid) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('✅ Admin actions foreign key added');
    } catch (error) {
      console.log('⚠️ Admin actions foreign key might already exist:', error.message);
    }

    try {
      await connection.execute(`
        ALTER TABLE events 
        ADD CONSTRAINT fk_events_creator 
        FOREIGN KEY (created_by) REFERENCES accounts(guid) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('✅ Events foreign key added');
    } catch (error) {
      console.log('⚠️ Events foreign key might already exist:', error.message);
    }

    // Verify foreign keys
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
    
    console.log('\n🔗 Foreign key constraints after fix:');
    console.table(foreignKeys);

    await connection.end();
    console.log('\n✅ Foreign key setup completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing foreign keys:', error);
  }
};

fixForeignKeys();
