const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'muonline',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function createNewsTable() {
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    
    console.log('Creating news table...');

    // Create news table
    const createNewsTableQuery = `
      CREATE TABLE IF NOT EXISTS news (
        id INT AUTO_INCREMENT PRIMARY KEY,
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
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(createNewsTableQuery);
    console.log('✓ News table created successfully');

    // Insert some sample news articles
    const insertSampleNews = `
      INSERT INTO news (title, content, excerpt, category, status, featured, author, published_at) VALUES
      ('Welcome to Mishki MU Online!', 
       '<p>Welcome to the official Mishki MU Online server! We are excited to bring you the best MU Online experience with enhanced features, balanced gameplay, and an active community.</p><p>Our server features:</p><ul><li>High EXP rates for faster leveling</li><li>Custom events and quests</li><li>Balanced PvP system</li><li>24/7 support</li></ul>',
       'Welcome to the official Mishki MU Online server! Experience enhanced gameplay and join our active community.',
       'announcements', 'published', 1, 'Admin', NOW()),
      
      ('Server Maintenance Notice', 
       '<p>Dear players, we will be performing scheduled maintenance on our servers to improve performance and add new features.</p><p><strong>Maintenance Schedule:</strong></p><ul><li>Start: Tomorrow at 02:00 AM (GMT)</li><li>Duration: 2-3 hours</li><li>End: Tomorrow at 05:00 AM (GMT)</li></ul><p>During this time, the game will be inaccessible. We apologize for any inconvenience.</p>',
       'Scheduled server maintenance to improve performance and add new features.',
       'maintenance', 'published', 0, 'Admin', NOW()),
      
      ('New Event: Double EXP Weekend!', 
       '<p>Get ready for an amazing Double EXP Weekend event!</p><p><strong>Event Details:</strong></p><ul><li>Start: Friday 6:00 PM (GMT)</li><li>End: Sunday 11:59 PM (GMT)</li><li>Bonus: 2x Experience Points</li><li>Bonus: 1.5x Drop Rate</li></ul><p>This is the perfect opportunity to level up your characters and hunt for rare items!</p>',
       'Join our Double EXP Weekend event with 2x experience and increased drop rates!',
       'events', 'published', 1, 'Admin', NOW()),
      
      ('Beginner''s Guide: Getting Started', 
       '<p>New to MU Online? This comprehensive guide will help you get started on your adventure!</p><h3>Character Creation</h3><p>Choose from various character classes, each with unique abilities...</p><h3>Basic Controls</h3><p>Learn the essential controls for movement, combat, and inventory management...</p><h3>Leveling Tips</h3><p>Efficient ways to gain experience and level up quickly...</p>',
       'Complete beginner''s guide to help new players start their MU Online journey.',
       'guides', 'published', 0, 'Admin', NOW()),
      
      ('Upcoming Features Preview', 
       '<p>We''re working hard on exciting new features coming to Mishki MU Online!</p><h3>What''s Coming:</h3><ul><li>New dungeon system</li><li>Guild wars improvements</li><li>Character customization options</li><li>Mobile companion app</li></ul><p>Stay tuned for more details!</p>',
       'Preview of exciting new features coming to Mishki MU Online.',
       'updates', 'draft', 0, 'Admin', NULL)
      ON DUPLICATE KEY UPDATE id=id;
    `;

    await connection.execute(insertSampleNews);
    console.log('✓ Sample news articles inserted');

    await connection.end();
    console.log('✓ News table setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up news table:', error);
    process.exit(1);
  }
}

createNewsTable();
