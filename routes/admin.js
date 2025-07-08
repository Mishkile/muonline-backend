const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Admin Authentication Routes
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    // Hash the password and check against admin_credentials
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const adminQuery = `
      SELECT id, username, role, permissions, last_login 
      FROM admin_credentials 
      WHERE username = ? AND password = ?
    `;
    
    const adminResult = await db.query(adminQuery, [username, hashedPassword]);
    
    if (adminResult.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    const admin = adminResult[0];
    
    // Update last login
    await db.query(
      'UPDATE admin_credentials SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );

    // Debug: Check if JWT_SECRET is loaded
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
    
    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          permissions: typeof admin.permissions === 'string' 
            ? JSON.parse(admin.permissions) 
            : admin.permissions,
          lastLogin: admin.last_login
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.get('/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development', async (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    try {
      // Get fresh admin data
      const adminQuery = `
        SELECT id, username, role, permissions 
        FROM admin_credentials 
        WHERE id = ?
      `;
      
      const adminResult = await db.query(adminQuery, [decoded.adminId]);
      
      if (adminResult.length === 0) {
        return res.status(401).json({ 
          success: false, 
          error: 'Admin not found' 
        });
      }

      const admin = adminResult[0];
      
      res.json({
        success: true,
        data: {
          admin: {
            id: admin.id,
            username: admin.username,
            role: admin.role,
            permissions: typeof admin.permissions === 'string' 
              ? JSON.parse(admin.permissions) 
              : admin.permissions
          }
        }
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  });
});

// Middleware to verify admin JWT token
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development', async (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

    try {
      // Verify admin still exists and is active
      const adminQuery = `
        SELECT id, username, role, permissions 
        FROM admin_credentials 
        WHERE id = ?
      `;
      const adminResult = await db.query(adminQuery, [decoded.adminId]);
      
      if (adminResult.length === 0) {
        return res.status(403).json({ success: false, error: 'Admin not found' });
      }

      req.admin = adminResult[0];
      next();
    } catch (error) {
      console.error('Error verifying admin:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
};

// Dashboard Statistics
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    // Get overall statistics
    const statsQueries = [
      'SELECT COUNT(*) as total FROM accounts',
      'SELECT COUNT(*) as total FROM character_info',
      'SELECT COUNT(*) as total FROM character_info WHERE online = 1',
      'SELECT COUNT(*) as total FROM news WHERE status = "published"'
    ];

    const [totalAccounts, totalCharacters, onlineCharacters, totalNews] = await Promise.all(
      statsQueries.map(query => db.query(query))
    );

    // Get recent registrations (last 7 days)
    const recentRegistrationsQuery = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM accounts 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    const recentRegistrations = await db.query(recentRegistrationsQuery);

    // Get top level characters
    const topCharactersQuery = `
      SELECT name as character_name, level as character_level, race as character_class
      FROM character_info 
      ORDER BY level DESC 
      LIMIT 10
    `;
    const topCharacters = await db.query(topCharactersQuery);

    // Get server status (mock data for now)
    const serverStatus = {
      gameServer: 'Online',
      webServer: 'Online',
      database: 'Online',
      lastRestart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    };

    res.json({
      success: true,
      data: {
        totals: {
          accounts: totalAccounts[0].total,
          characters: totalCharacters[0].total,
          onlineCharacters: onlineCharacters[0].total,
          news: totalNews[0].total
        },
        recentRegistrations,
        topCharacters,
        serverStatus
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard statistics' 
    });
  }
});

// Account Management
router.get('/accounts', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || 'all';

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (a.account LIKE ? OR a.email LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (status !== 'all') {
      switch (status) {
        case 'active':
          whereClause += ' AND a.blocked = 0';
          break;
        case 'blocked':
          whereClause += ' AND a.blocked = 1';
          break;
        case 'unverified':
          whereClause += ' AND a.activated = 0';
          break;
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM accounts a ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = countResult[0].total;

    // Get accounts
    const accountsQuery = `
      SELECT 
        a.guid as id,
        a.account as username,
        a.email,
        a.created_at,
        a.blocked,
        a.activated,
        a.web_admin,
        a.gm_level,
        (SELECT COUNT(*) FROM character_info WHERE account_id = a.guid) as character_count
      FROM accounts a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    const accounts = await db.query(accountsQuery, queryParams);

    res.json({
      success: true,
      data: accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch accounts' 
    });
  }
});

// Get specific account details
router.get('/accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const accountId = req.params.id;

    const accountQuery = `
      SELECT 
        a.guid as id,
        a.account as username,
        a.email,
        a.created_at,
        a.blocked,
        a.activated,
        a.web_admin,
        a.gm_level,
        av.email_verified,
        av.phone_verified
      FROM accounts a
      LEFT JOIN accounts_validation av ON a.guid = av.account_id
      WHERE a.guid = ?
    `;

    const account = await db.query(accountQuery, [accountId]);
    
    if (account.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Get account characters
    const charactersQuery = `
      SELECT 
        name as character_name,
        level as character_level,
        race as character_class,
        map as map_id,
        pk_count,
        pk_level,
        online as connected,
        last_login,
        created_at
      FROM character_info
      WHERE account_id = ?
      ORDER BY level DESC
    `;

    const characters = await db.query(charactersQuery, [accountId]);

    res.json({
      success: true,
      data: {
        account: account[0],
        characters
      }
    });
  } catch (error) {
    console.error('Error fetching account details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch account details' 
    });
  }
});

// Update account
router.put('/accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const accountId = req.params.id;
    const { blocked, activated, web_admin, gm_level } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update accounts table
      if (blocked !== undefined || activated !== undefined || web_admin !== undefined || gm_level !== undefined) {
        const updateFields = [];
        const updateValues = [];

        if (blocked !== undefined) {
          updateFields.push('blocked = ?');
          updateValues.push(blocked ? 1 : 0);
        }
        if (activated !== undefined) {
          updateFields.push('activated = ?');
          updateValues.push(activated ? 1 : 0);
        }
        if (web_admin !== undefined) {
          updateFields.push('web_admin = ?');
          updateValues.push(web_admin);
        }
        if (gm_level !== undefined) {
          updateFields.push('gm_level = ?');
          updateValues.push(gm_level);
        }

        updateValues.push(accountId);

        const updateAccountQuery = `
          UPDATE accounts 
          SET ${updateFields.join(', ')}
          WHERE guid = ?
        `;
        await connection.execute(updateAccountQuery, updateValues);
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Account updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update account' 
    });
  }
});

// Character Management
router.get('/characters', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const online = req.query.online || 'all';

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR a.account LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (online === 'true') {
      whereClause += ' AND c.online = 1';
    } else if (online === 'false') {
      whereClause += ' AND c.online = 0';
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM character_info c
      LEFT JOIN accounts a ON c.account_id = a.guid
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = countResult[0].total;

    // Get characters
    const charactersQuery = `
      SELECT 
        c.name as characterName,
        c.level as characterLevel,
        c.race as characterClass,
        c.world as mapId,
        c.pk_count,
        c.pk_level,
        c.online as connected,
        c.last_use as lastLogin,
        c.create_date as createdAt,
        c.strength,
        c.agility,
        c.vitality,
        c.energy,
        c.leadership,
        c.money as zen,
        c.account_id,
        a.account as accountName
      FROM character_info c
      LEFT JOIN accounts a ON c.account_id = a.guid
      ${whereClause}
      ORDER BY c.level DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    const characters = await db.query(charactersQuery, queryParams);

    res.json({
      success: true,
      data: characters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch characters' 
    });
  }
});

// Clear character PK
router.post('/characters/:name/clear-pk', authenticateAdmin, async (req, res) => {
  try {
    const characterName = req.params.name;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Clear PK count and level
      const clearPkQuery = `
        UPDATE character_info 
        SET pk_count = 0, pk_level = 0
        WHERE name = ?
      `;
      await connection.execute(clearPkQuery, [characterName]);

      // Log the action
      const logQuery = `
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_name, details, created_at)
        VALUES (?, 'clear_pk', 'character', ?, 'PK cleared by admin', NOW())
      `;
      await connection.execute(logQuery, [req.user.userId, characterName]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Character PK cleared successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error clearing character PK:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear character PK' 
    });
  }
});

// News Management (Admin version with full CRUD)
router.get('/news', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (status !== 'all') {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM news ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = countResult[0].total;

    // Get news items
    const newsQuery = `
      SELECT 
        id,
        title,
        content,
        excerpt,
        image_url,
        category,
        status,
        author,
        featured,
        meta_title,
        meta_description,
        created_at,
        updated_at,
        published_at
      FROM news 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);
    
    const news = await db.query(newsQuery, queryParams);

    res.json({
      success: true,
      data: news,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch news' 
    });
  }
});

// Create news article
router.post('/news', authenticateAdmin, async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      category,
      status,
      featured,
      image_url,
      meta_title,
      meta_description
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    const newsQuery = `
      INSERT INTO news (
        title, content, excerpt, category, status, featured, 
        image_url, meta_title, meta_description, author, 
        created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
    `;

    const publishedAt = status === 'published' ? new Date() : null;

    const result = await db.query(newsQuery, [
      title,
      content,
      excerpt || '',
      category || 'general',
      status || 'draft',
      featured ? 1 : 0,
      image_url || null,
      meta_title || title,
      meta_description || excerpt || '',
      req.admin.username || 'Admin',
      publishedAt
    ]);

    res.json({
      success: true,
      message: 'News article created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error creating news article:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create news article' 
    });
  }
});

// Update news article
router.put('/news/:id', authenticateAdmin, async (req, res) => {
  try {
    const newsId = req.params.id;
    const {
      title,
      content,
      excerpt,
      category,
      status,
      featured,
      image_url,
      meta_title,
      meta_description
    } = req.body;

    const publishedAt = status === 'published' ? new Date() : null;

    const updateQuery = `
      UPDATE news 
      SET 
        title = ?, content = ?, excerpt = ?, category = ?, 
        status = ?, featured = ?, image_url = ?, meta_title = ?, 
        meta_description = ?, updated_at = NOW(), published_at = ?
      WHERE id = ?
    `;

    await db.query(updateQuery, [
      title,
      content,
      excerpt || '',
      category || 'general',
      status || 'draft',
      featured ? 1 : 0,
      image_url || null,
      meta_title || title,
      meta_description || excerpt || '',
      publishedAt,
      newsId
    ]);

    res.json({
      success: true,
      message: 'News article updated successfully'
    });
  } catch (error) {
    console.error('Error updating news article:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update news article' 
    });
  }
});

// Delete news article
router.delete('/news/:id', authenticateAdmin, async (req, res) => {
  try {
    const newsId = req.params.id;

    const deleteQuery = 'DELETE FROM news WHERE id = ?';
    await db.query(deleteQuery, [newsId]);

    res.json({
      success: true,
      message: 'News article deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting news article:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete news article' 
    });
  }
});

// Server Management
router.get('/server/status', authenticateAdmin, async (req, res) => {
  try {
    // Get online players count
    const onlineQuery = 'SELECT COUNT(*) as count FROM character_info WHERE online = 1';
    const onlineResult = await db.query(onlineQuery);

    // Mock server data (in a real scenario, you'd check actual server processes)
    const serverStatus = {
      gameServer: {
        status: 'online',
        uptime: '2 days, 14 hours',
        players: onlineResult[0].count,
        maxPlayers: 1000,
        cpu: 45,
        memory: 67,
        lastRestart: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      webServer: {
        status: 'online',
        uptime: '7 days, 3 hours',
        cpu: 12,
        memory: 23,
        lastRestart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      database: {
        status: 'online',
        connections: 45,
        maxConnections: 100,
        cpu: 8,
        memory: 34
      }
    };

    res.json({
      success: true,
      data: serverStatus
    });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch server status' 
    });
  }
});

// Send global message (broadcast)
router.post('/server/broadcast', authenticateAdmin, async (req, res) => {
  try {
    const { message, type } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // In a real implementation, this would send a command to the game server
    // For now, we'll just log it and store it in database for reference
    
    const logQuery = `
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_name, details, created_at)
      VALUES (?, 'broadcast', 'server', 'global', ?, NOW())
    `;
    await db.query(logQuery, [req.user.userId, `Message: ${message}, Type: ${type}`]);

    res.json({
      success: true,
      message: 'Broadcast message sent successfully'
    });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send broadcast message' 
    });
  }
});

module.exports = router;
