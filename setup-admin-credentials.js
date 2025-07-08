const mysql = require('mysql2/promise');
require('dotenv').config();
const crypto = require('crypto');

const setupAdminCredentials = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database...');

    // Create admin_credentials table
    const adminCredentialsTableQuery = `
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'moderator') DEFAULT 'admin',
        permissions JSON,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(adminCredentialsTableQuery);
    console.log('✅ Admin credentials table created/verified');

    // Check if admin account exists
    const checkAdminQuery = 'SELECT COUNT(*) as count FROM admin_credentials WHERE username = ?';
    const [adminExists] = await connection.execute(checkAdminQuery, ['admin']);

    if (adminExists[0].count === 0) {
      // Create default admin account
      const hashedPassword = crypto.createHash('sha256').update('admin123').digest('hex');
      const permissions = {
        accounts: { read: true, write: true, delete: true },
        characters: { read: true, write: true, delete: true },
        news: { read: true, write: true, delete: true },
        server: { read: true, write: true }
      };

      const insertAdminQuery = `
        INSERT INTO admin_credentials (username, password, role, permissions) 
        VALUES (?, ?, 'admin', ?)
      `;
      await connection.execute(insertAdminQuery, [
        'admin', 
        hashedPassword, 
        JSON.stringify(permissions)
      ]);

      console.log('✅ Default admin account created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the password after first login!');
    } else {
      console.log('ℹ️  Admin account already exists');
    }

    await connection.end();
    console.log('\n✅ Admin credentials setup completed!');
  } catch (error) {
    console.error('❌ Error setting up admin credentials:', error);
    process.exit(1);
  }
};

setupAdminCredentials();
