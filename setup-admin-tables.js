const mysql = require('mysql2/promise');
require('dotenv').config();

const createTables = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database...');

    // Create news table
    const newsTableQuery = `
      CREATE TABLE IF NOT EXISTS news (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        image_url VARCHAR(500),
        category VARCHAR(100) DEFAULT 'general',
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        featured BOOLEAN DEFAULT FALSE,
        author VARCHAR(100),
        meta_title VARCHAR(255),
        meta_description TEXT,
        views_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        published_at TIMESTAMP NULL,
        INDEX idx_status (status),
        INDEX idx_category (category),
        INDEX idx_featured (featured),
        INDEX idx_published_at (published_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(newsTableQuery);
    console.log('✅ News table created/verified');

    // Create admin_actions table for logging admin activities
    const adminActionsTableQuery = `
      CREATE TABLE IF NOT EXISTS admin_actions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_id INT UNSIGNED NOT NULL,
        admin_username VARCHAR(50),
        action_type VARCHAR(100) NOT NULL,
        target_type VARCHAR(100),
        target_name VARCHAR(255),
        details TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_id (admin_id),
        INDEX idx_action_type (action_type),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (admin_id) REFERENCES accounts(guid) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(adminActionsTableQuery);
    console.log('✅ Admin actions table created/verified');

    // Create events table for game events
    const eventsTableQuery = `
      CREATE TABLE IF NOT EXISTS events (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        event_type VARCHAR(100) DEFAULT 'general',
        rewards TEXT,
        image_url VARCHAR(500),
        status ENUM('active', 'inactive', 'ended') DEFAULT 'active',
        created_by INT UNSIGNED,
        created_by_username VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_event_type (event_type),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date),
        FOREIGN KEY (created_by) REFERENCES accounts(guid) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(eventsTableQuery);
    console.log('✅ Events table created/verified');

    // Insert sample news articles if the table is empty
    const checkNewsQuery = 'SELECT COUNT(*) as count FROM news';
    const [newsCount] = await connection.execute(checkNewsQuery);
    
    if (newsCount[0].count === 0) {
      const sampleNewsQuery = `
        INSERT INTO news (title, content, excerpt, category, status, featured, author, published_at) VALUES
        ('Welcome to Mishki MU Season 19', 
         '<h2>Welcome Warriors!</h2><p>We are excited to announce the launch of Mishki MU Season 19 Episode 2! Join us for an epic adventure in the world of MU Online.</p><p>New features include:</p><ul><li>Enhanced PvP system</li><li>New items and sets</li><li>Improved drop rates</li><li>Special events every week</li></ul>', 
         'Join us for the launch of Season 19 with new features and improvements!', 
         'announcement', 'published', 1, 'Admin', NOW()),
        ('Server Maintenance Schedule', 
         '<h2>Scheduled Maintenance</h2><p>Dear players, we will be performing routine server maintenance to improve performance and stability.</p><p><strong>Maintenance Time:</strong> Every Tuesday 03:00 - 05:00 GMT</p><p>During this time, the server will be temporarily unavailable.</p>', 
         'Regular server maintenance information for all players.', 
         'maintenance', 'published', 0, 'Admin', NOW()),
        ('New Drop Event Starting Soon!', 
         '<h2>Special Drop Event</h2><p>Get ready for increased drop rates across all maps! This weekend enjoy:</p><ul><li>2x Drop Rate</li><li>1.5x Experience</li><li>Special rare items</li></ul><p>Event runs from Friday to Sunday. Do not miss out!</p>', 
         'Special weekend event with increased drops and experience!', 
         'event', 'published', 1, 'Admin', NOW())
      `;
      await connection.execute(sampleNewsQuery);
      console.log('✅ Sample news articles inserted');
    }

    // Check if gm_level column exists in accounts table, add if missing
    const checkGmLevelQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'accounts' 
      AND COLUMN_NAME = 'gm_level'
    `;
    const [gmLevelExists] = await connection.execute(checkGmLevelQuery, [process.env.DB_NAME]);
    
    if (gmLevelExists.length === 0) {
      const addGmLevelQuery = `
        ALTER TABLE accounts 
        ADD COLUMN gm_level INT DEFAULT 0 AFTER web_admin
      `;
      await connection.execute(addGmLevelQuery);
      console.log('✅ gm_level column added to accounts table');
    }

    await connection.end();
    console.log('✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
};

createTables();
