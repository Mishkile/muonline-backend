const express = require('express');
const db = require('../config/database');
const dbHelpers = require('../utils/dbHelpers');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get player profile information
router.get('/profile/:playerName', async (req, res) => {
  try {
    const { playerName } = req.params;

    // Use helper to get character info from any available table
    const player = await dbHelpers.getCharacterInfo(playerName);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get account information
    let accountInfo = null;
    try {
      const accountQuery = `
        SELECT account, email, register as account_created
        FROM accounts 
        WHERE guid = ?
      `;
      accountInfo = await db.queryOne(accountQuery, [player.account_id]);
    } catch (accountError) {
      console.log('Account lookup failed:', accountError.message);
    }

    // Try to get guild information using helper
    const guildInfo = await dbHelpers.getGuildInfo(playerName);

    // Get equipment information (if you have equipment table)
    let equipment = [];
    try {
      const equipmentQuery = `
        SELECT item_id, item_level, item_option, item_duration, item_serial
        FROM character_item 
        WHERE character_name = ? AND item_section BETWEEN 0 AND 11
        ORDER BY item_section
      `;
      equipment = await db.query(equipmentQuery, [playerName]);
    } catch (equipError) {
      console.log('Equipment lookup failed (continuing without equipment):', equipError.message);
    }

    res.json({
      character: {
        name: player.name,
        level: player.level,
        experience: player.experience,
        resets: player.reset || 0,
        masterLevel: player.level_master || 0,
        masterExperience: player.experience_master || 0,
        characterClass: getClassNameById(player.race),
        strength: player.strength || 0,
        dexterity: player.dexterity || 0,
        vitality: player.vitality || 0,
        energy: player.energy || 0,
        leadership: player.leadership || 0,
        levelUpPoint: player.level_up_point || 0,
        money: player.money || 0,
        pkCount: player.pk_count || 0,
        pkLevel: player.pk_level || 0,
        pkTime: player.pk_time || 0,
        mapNumber: player.map_number || 0,
        mapPosX: player.map_pos_x || 0,
        mapPosY: player.map_pos_y || 0,
        mapDir: player.map_dir || 0,
        accountName: accountInfo?.account || 'Unknown',
        accountCreated: accountInfo?.account_created || null,
        guild: guildInfo ? {
          name: guildInfo.guild_name,
          guildMaster: guildInfo.guild_master
        } : null
      },
      equipment: equipment,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Player profile error:', error);
    res.status(500).json({ error: 'Failed to fetch player profile' });
  }
});

// Get user's characters (protected route)
router.get('/characters', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT 
        c.name,
        c.clevel,
        c.resets,
        c.cclass,
        c.master_level,
        c.map_number,
        c.money,
        c.pkcount,
        c.experience,
        g.name as guild_name
      FROM character c
      LEFT JOIN guild_member gm ON c.name = gm.name
      LEFT JOIN guild g ON gm.guild_id = g.guild_id
      WHERE c.account_id = ? AND c.ctl_code = 0
      ORDER BY c.clevel DESC
    `;

    const characters = await db.query(query, [userId]);

    res.json({
      characters: characters.map(char => ({
        name: char.name,
        level: char.clevel,
        resets: char.resets || 0,
        characterClass: getClassNameById(char.cclass),
        masterLevel: char.master_level || 0,
        mapNumber: char.map_number,
        money: char.money || 0,
        pkCount: char.pkcount || 0,
        experience: char.experience || 0,
        guildName: char.guild_name || 'None'
      }))
    });

  } catch (error) {
    console.error('User characters error:', error);
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

// Get guild information
router.get('/guild/:guildName', async (req, res) => {
  try {
    const { guildName } = req.params;

    // Get guild basic info
    const guildQuery = `
      SELECT 
        g.*,
        COUNT(gm.name) as member_count
      FROM guild g
      LEFT JOIN guild_member gm ON g.guild_id = gm.guild_id
      WHERE g.name = ?
      GROUP BY g.guild_id
    `;

    const guild = await db.queryOne(guildQuery, [guildName]);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    // Get guild members
    const membersQuery = `
      SELECT 
        gm.name,
        gm.guild_status,
        c.clevel,
        c.resets,
        c.cclass,
        c.master_level,
        ast.online,
        ast.last_online
      FROM guild_member gm
      INNER JOIN character c ON gm.name = c.name
      INNER JOIN accounts a ON c.account_id = a.guid
      LEFT JOIN accounts_status ast ON a.guid = ast.account_id
      WHERE gm.guild_id = ?
      ORDER BY gm.guild_status DESC, c.clevel DESC
    `;

    const members = await db.query(membersQuery, [guild.guild_id]);

    res.json({
      guild: {
        name: guild.name,
        guildMaster: guild.guild_master,
        notice: guild.notice || '',
        score: guild.score || 0,
        memberCount: guild.member_count || 0,
        logo: guild.logo
      },
      members: members.map(member => ({
        name: member.name,
        level: member.clevel,
        resets: member.resets || 0,
        characterClass: getClassNameById(member.cclass),
        masterLevel: member.master_level || 0,
        status: getGuildStatusName(member.guild_status),
        online: member.online === 1,
        lastOnline: member.last_online
      }))
    });

  } catch (error) {
    console.error('Guild info error:', error);
    res.status(500).json({ error: 'Failed to fetch guild information' });
  }
});

// Helper functions
function getClassNameById(classId) {
  const classes = {
    0: 'Dark Wizard', 1: 'Soul Master', 2: 'Grand Master', 3: 'Soul Wizard',
    16: 'Dark Knight', 17: 'Blade Knight', 18: 'Blade Master', 19: 'Dragon Knight',
    32: 'Fairy Elf', 33: 'Muse Elf', 34: 'High Elf', 35: 'Noble Elf',
    48: 'Magic Gladiator', 49: 'Duel Master',
    64: 'Dark Lord', 65: 'Lord Emperor',
    80: 'Summoner', 81: 'Bloody Summoner', 82: 'Dimension Master',
    96: 'Rage Fighter', 97: 'Fist Blazer', 98: 'Fist Master',
    112: 'Grow Lancer', 113: 'Mirage Knight',
    128: 'Rune Wizard', 129: 'Rune Spell Master', 130: 'Grand Rune Master',
    144: 'Slayer', 145: 'Royal Slayer', 146: 'Master Slayer',
    160: 'Gun Crusher', 161: 'Gun Breaker', 162: 'Master Gun Breaker',
    176: 'Light Wizard', 177: 'Shine Wizard', 178: 'Luminous Wizard',
    192: 'Lemuria', 193: 'War Lemuria', 194: 'Arch Lemuria',
    208: 'Illusion Knight', 209: 'Mirage Knight'
  };
  
  return classes[classId] || 'Unknown';
}

function getGuildStatusName(status) {
  const statuses = {
    0x80: 'Guild Master',
    0x20: 'Assistant',
    0x40: 'Battle Master',
    0x00: 'Member'
  };
  
  return statuses[status] || 'Member';
}

module.exports = router;
