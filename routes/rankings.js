const express = require('express');
const db = require('../config/database');
const dbHelpers = require('../utils/dbHelpers');
const router = express.Router();

// Get player rankings by different criteria
router.get('/players', async (req, res) => {
  try {
    const { type = 'level', limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let orderBy;
    let whereClause = '';
    
    switch (type) {
      case 'level':
        orderBy = 'ci.level DESC, ci.experience DESC';
        break;
      case 'resets':
        orderBy = 'ci.reset DESC, ci.level DESC';
        break;
      case 'master_level':
        orderBy = 'ci.level_master DESC, ci.experience_master DESC';
        break;
      case 'pk':
        orderBy = 'ci.pk_count DESC';
        break;
      case 'online':
        orderBy = 'ci.level DESC';
        whereClause = 'AND ci.online = 1';
        break;
      default:
        orderBy = 'ci.level DESC, ci.experience DESC';
    }

    // Use helper function to get characters from any available table
    const players = await dbHelpers.getCharactersForRankings(orderBy, whereClause, parseInt(limit), parseInt(offset));
    
    // Get total count for pagination
    const totalPlayers = await dbHelpers.getCharacterCount(whereClause);

    res.json({
      players: players.map((player, index) => ({
        rank: offset + index + 1,
        name: player.name,
        level: player.level,
        experience: player.experience,
        resets: player.reset || 0,
        masterLevel: player.level_master || 0,
        masterExperience: player.experience_master || 0,
        characterClass: getClassNameById(player.race),
        pkCount: player.pk_count || 0,
        pkLevel: player.pk_level || 0,
        accountName: player.account_name,
        guildName: player.guild_name || 'None'
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPlayers / limit),
        totalPlayers: totalPlayers,
        playersPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Get guild rankings
router.get('/guilds', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        gl.name,
        ci_master.name as guild_master,
        COUNT(gm.char_id) as member_count,
        AVG(ci.level) as avg_level,
        SUM(ci.reset) as total_resets,
        gl.notice,
        gl.emblem
      FROM guild_list gl
      LEFT JOIN guild_members gm ON gl.guid = gm.guild_id
      LEFT JOIN character_info ci ON gm.char_id = ci.guid
      LEFT JOIN guild_members gm_master ON gl.guid = gm_master.guild_id AND gm_master.ranking = 0
      LEFT JOIN character_info ci_master ON gm_master.char_id = ci_master.guid
      GROUP BY gl.guid, gl.name, ci_master.name, gl.notice, gl.emblem
      ORDER BY total_resets DESC, avg_level DESC, member_count DESC
      LIMIT ? OFFSET ?
    `;

    const guilds = await db.query(query, [parseInt(limit), parseInt(offset)]);

    // Get total count
    const countResult = await db.queryOne('SELECT COUNT(*) as total FROM guild_list');

    res.json({
      guilds: guilds.map((guild, index) => ({
        rank: offset + index + 1,
        name: guild.name,
        guildMaster: guild.guild_master || 'N/A',
        memberCount: guild.member_count || 0,
        averageLevel: Math.round(guild.avg_level || 0),
        totalResets: guild.total_resets || 0,
        notice: guild.notice || '',
        logo: guild.emblem
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(countResult.total / limit),
        totalGuilds: countResult.total,
        guildsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Guild rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch guild rankings' });
  }
});

// Helper function to convert class ID to class name
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

module.exports = router;
