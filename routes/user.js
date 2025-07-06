const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const profileQuery = `
      SELECT 
        a.account_id,
        a.username,
        a.email,
        a.real_name,
        a.phone,
        a.country,
        a.created_at,
        ad.last_login,
        ad.login_count,
        ad.total_time_played,
        av.email_verified,
        av.phone_verified
      FROM accounts a
      LEFT JOIN account_data ad ON a.account_id = ad.account_id
      LEFT JOIN accounts_validation av ON a.account_id = av.account_id
      WHERE a.account_id = ?
    `;

    const profile = await db.query(profileQuery, [userId]);

    if (profile.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Get user characters
    const charactersQuery = `
      SELECT 
        c.character_name,
        c.character_level,
        c.character_class,
        c.character_experience,
        c.character_money,
        c.character_points,
        c.character_strength,
        c.character_dexterity,
        c.character_vitality,
        c.character_energy,
        c.character_leadership,
        c.map_id,
        c.pk_count,
        c.pk_level,
        c.total_kill_count,
        c.total_death_count,
        c.created_at,
        c.last_login
      FROM characters c
      WHERE c.account_id = ?
      ORDER BY c.character_level DESC
    `;

    const characters = await db.query(charactersQuery, [userId]);

    res.json({
      success: true,
      data: {
        profile: profile[0],
        characters: characters
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user profile' 
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { email, realName, phone, country } = req.body;

    // Validate input
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const updateQuery = `
      UPDATE accounts 
      SET 
        email = COALESCE(?, email),
        real_name = COALESCE(?, real_name),
        phone = COALESCE(?, phone),
        country = COALESCE(?, country),
        updated_at = NOW()
      WHERE account_id = ?
    `;

    await db.query(updateQuery, [email, realName, phone, country, userId]);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get current user data including username
    const userQuery = 'SELECT account, password FROM accounts WHERE account_id = ?';
    const userResult = await db.query(userQuery, [userId]);

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const username = userResult[0].account;

    // Verify current password using MU Online format: SHA256(account:password)
    const currentPasswordHash = crypto.createHash('sha256').update(`${username}:${currentPassword}`).digest('hex');
    
    if (userResult[0].password !== currentPasswordHash) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password using MU Online format
    const newPasswordHash = crypto.createHash('sha256').update(`${username}:${newPassword}`).digest('hex');

    // Update password
    const updateQuery = `
      UPDATE accounts 
      SET password = ?, updated_at = NOW()
      WHERE account_id = ?
    `;

    await db.query(updateQuery, [newPasswordHash, userId]);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to change password' 
    });
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const statsQuery = `
      SELECT 
        COUNT(c.character_name) as total_characters,
        MAX(c.character_level) as highest_level,
        SUM(c.total_kill_count) as total_kills,
        SUM(c.total_death_count) as total_deaths,
        SUM(c.character_money) as total_zen,
        AVG(c.character_level) as average_level
      FROM characters c
      WHERE c.account_id = ?
    `;

    const stats = await db.query(statsQuery, [userId]);

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user statistics' 
    });
  }
});

// Get user guild information
router.get('/guild', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const guildQuery = `
      SELECT 
        g.guild_name,
        g.guild_master,
        g.guild_mark,
        g.guild_notice,
        g.guild_score,
        g.guild_level,
        g.alliance_guild,
        g.rival_guild,
        g.union_name,
        gm.guild_status,
        gm.guild_position
      FROM guild g
      INNER JOIN guild_member gm ON g.guild_name = gm.guild_name
      INNER JOIN characters c ON gm.character_name = c.character_name
      WHERE c.account_id = ?
    `;

    const guild = await db.query(guildQuery, [userId]);

    if (guild.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'User is not in a guild'
      });
    }

    res.json({
      success: true,
      data: guild[0]
    });
  } catch (error) {
    console.error('Error fetching user guild:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch guild information' 
    });
  }
});

// Get user characters
router.get('/characters', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    console.log('🔍 Characters endpoint called');
    console.log('JWT payload:', req.user);
    console.log('Looking for characters with account_id:', userId);

    const charactersQuery = `
      SELECT 
        c.name,
        c.level,
        c.race,
        c.world,
        c.world_x,
        c.world_y,
        c.money,
        c.pk_level,
        c.pk_count,
        c.online,
        g.name as guild,
        c.reset
      FROM character_info c
      LEFT JOIN guild_members gm ON c.guid = gm.char_id
      LEFT JOIN guild_list g ON gm.guild_id = g.guid
      WHERE c.account_id = ?
      ORDER BY c.level DESC
    `;

    console.log('Executing query with userId:', userId);
    const characters = await db.query(charactersQuery, [userId]);
    console.log(`Query returned ${characters.length} characters`);
    
    // Log the first few characters to verify they belong to the correct user
    if (characters.length > 0) {
      console.log('Sample characters returned:');
      characters.slice(0, 3).forEach(char => {
        console.log(`- ${char.name} (account_id should be ${userId})`);
      });
      
      // Double-check: manually verify the account_id for the first character
      const verifyQuery = `SELECT account_id FROM character_info WHERE name = ?`;
      const verification = await db.query(verifyQuery, [characters[0].name]);
      console.log(`Verification - ${characters[0].name} has account_id: ${verification[0]?.account_id}`);
    }

    // Transform the character data
    const transformedCharacters = characters.map(char => ({
      name: char.name,
      level: char.level,
      class: getClassName(char.race),
      map: getMapName(char.world),
      money: char.money,
      pkLevel: char.pk_level,
      pkCount: char.pk_count,
      online: char.online === 1,
      guild: char.guild || null,
      resets: char.reset || 0
    }));

    res.json({
      success: true,
      data: {
        characters: transformedCharacters,
        total: transformedCharacters.length
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

// Clear PK status for a character
router.post('/characters/:characterName/clear-pk', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { characterName } = req.params;
    const PK_CLEAR_COST = 100;

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Verify character belongs to user
      const characterCheck = await db.queryOne(
        `SELECT c.name, c.pk_level
         FROM character_info c
         WHERE c.name = ? AND c.account_id = ?`,
        [characterName, userId]
      );

      if (!characterCheck) {
        await db.query('ROLLBACK');
        return res.status(404).json({ 
          success: false, 
          error: 'Character not found or does not belong to your account' 
        });
      }

      // Check if character has PK to clear
      if (characterCheck.pk_level <= 0) {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Character has no PK status to clear' 
        });
      }

      // Check user credits
      const userCredits = await db.queryOne(
        'SELECT credits FROM account_data WHERE account_id = ?',
        [userId]
      );

      if (!userCredits || userCredits.credits < PK_CLEAR_COST) {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Insufficient credits. PK clear costs 100 credits.' 
        });
      }

      // Deduct credits
      await db.query(
        'UPDATE account_data SET credits = credits - ? WHERE account_id = ?',
        [PK_CLEAR_COST, userId]
      );

      // Clear PK status
      await db.query(
        'UPDATE character_info SET pk_level = 0, pk_count = 0 WHERE name = ?',
        [characterName]
      );

      // Log the transaction
      await db.query(
        `INSERT INTO character_transaction_log (account_id, character_name, transaction_type, amount, description, created_at)
         VALUES (?, ?, 'pk_clear', ?, 'PK status cleared', NOW())`,
        [userId, characterName, PK_CLEAR_COST]
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        message: `PK status cleared for ${characterName}`,
        data: {
          creditsDeducted: PK_CLEAR_COST,
          remainingCredits: userCredits.credits - PK_CLEAR_COST
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error clearing PK:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear PK status' 
    });
  }
});

// Helper functions
function getClassName(classCode) {
  const classes = {
    0: 'Dark Wizard',
    1: 'Soul Master', 
    2: 'Grand Master',
    16: 'Dark Knight',
    17: 'Blade Knight',
    18: 'Blade Master',
    32: 'Fairy Elf',
    33: 'Muse Elf',
    34: 'High Elf',
    48: 'Magic Gladiator',
    64: 'Dark Lord',
    80: 'Summoner',
    96: 'Rage Fighter',
    112: 'Fist Master'
  };
  return classes[classCode] || 'Unknown';
}

function getMapName(mapCode) {
  const maps = {
    0: 'Lorencia',
    1: 'Dungeon',
    2: 'Devias',
    3: 'Noria',
    4: 'Lost Tower',
    5: 'Exile',
    6: 'Arena',
    7: 'Atlans',
    8: 'Tarkan',
    9: 'Devil Square',
    10: 'Icarus',
    11: 'Blood Castle 1',
    12: 'Blood Castle 2',
    13: 'Blood Castle 3',
    14: 'Blood Castle 4',
    15: 'Blood Castle 5',
    16: 'Blood Castle 6',
    17: 'Blood Castle 7',
    18: 'Chaos Castle 1',
    19: 'Chaos Castle 2',
    20: 'Chaos Castle 3',
    21: 'Chaos Castle 4',
    22: 'Chaos Castle 5',
    23: 'Chaos Castle 6',
    24: 'Kalima 1',
    25: 'Kalima 2',
    26: 'Kalima 3',
    27: 'Kalima 4',
    28: 'Kalima 5',
    29: 'Kalima 6',
    30: 'Valley of Loren',
    31: 'Land of Trials',
    32: 'Devil Square 2',
    33: 'Aida',
    34: 'Crywolf Fortress',
    37: 'Kanturu 1',
    38: 'Kanturu 2',
    39: 'Kanturu 3',
    40: 'Silent Map',
    41: 'Barracks of Balgass',
    42: 'Balgass Refuge',
    45: 'Illusion Temple 1',
    46: 'Illusion Temple 2',
    47: 'Illusion Temple 3',
    48: 'Illusion Temple 4',
    49: 'Illusion Temple 5',
    50: 'Illusion Temple 6',
    51: 'Elbeland',
    52: 'Blood Castle 8',
    53: 'Chaos Castle 7',
    56: 'Swamp of Calmness',
    57: 'Raklion',
    58: 'Raklion Boss',
    62: 'Santa Village',
    63: 'Vulcanus',
    64: 'Duel Arena',
    65: 'Doppelganger 1',
    66: 'Doppelganger 2',
    67: 'Doppelganger 3',
    68: 'Doppelganger 4',
    69: 'Empire Guardian 1',
    70: 'Empire Guardian 2',
    71: 'Empire Guardian 3',
    72: 'Empire Guardian 4'
  };
  return maps[mapCode] || 'Unknown';
}

module.exports = router;
