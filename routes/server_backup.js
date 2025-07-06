const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Get server status information
router.get('/', async (req, res) => {
  try {
    // Get real statistics from database
    const connection = await db.getConnection();
    
    const [accountResult] = await connection.execute('SELECT COUNT(*) as total_accounts FROM accounts');
    const [characterResult] = await connection.execute('SELECT COUNT(*) as total_characters FROM character_info');
    const [onlineResult] = await connection.execute('SELECT COUNT(*) as online_players FROM character_info WHERE online = 1');
    const [guildResult] = await connection.execute('SELECT COUNT(*) as total_guilds FROM guild_list');
    const [topPlayerResult] = await connection.execute('SELECT name, level, reset FROM character_info ORDER BY level DESC, reset DESC LIMIT 1');
    
    connection.release();

    const statistics = {
      playersOnline: onlineResult[0].online_players,
      totalAccounts: accountResult[0].total_accounts,
      totalCharacters: characterResult[0].total_characters,
      totalGuilds: guildResult[0].total_guilds,
      topPlayer: topPlayerResult[0] || null,
      castleOwner: "No Owner" // Default since we don't have castle siege data yet
    };

    const serverData = {
      server: {
        name: "Mishki MU S19.2.3",
        season: "Season 19 Part 2-3",
        rates: {
          experience: "1000x",
          drop: "30%",
          zen: "1000x",
          jewel: "15%"
        },
        features: [
          "Custom Wings",
          "Custom Sets", 
          "Anti-Hack Protection",
          "Castle Siege",
          "Blood Castle",
          "Devil Square",
          "Chaos Castle",
          "Illusion Temple"
        ],
        maxLevel: 400,
        maxMasterLevel: 400,
        maxResets: 999,
        status: "Online"
      },
      statistics,
      events: [
        {
          id: 1,
          title: "Server Launch",
          description: "Welcome to DV-Team Season 19 Part 2-3!",
          date: new Date().toISOString(),
          type: "announcement"
        },
        {
          id: 2,
          title: "Double EXP Event", 
          description: "Enjoy double experience rates this weekend!",
          date: new Date(Date.now() - 86400000).toISOString(),
          type: "event"
        }
      ],
      lastUpdate: new Date().toISOString()
    };

    // Try to get real data, but fall back to static data if queries fail
    try {
      // Get online player count
      const onlineResult = await db.queryOne(
        'SELECT COUNT(*) as count FROM character_info WHERE online = 1'
      ).catch(() => ({ count: 0 }));

      // Get total registered accounts
      const accountsResult = await db.queryOne(
        'SELECT COUNT(*) as count FROM accounts'
      ).catch(() => ({ count: 0 }));

      // Get total characters 
      const charactersResult = await db.queryOne(
        'SELECT COUNT(*) as count FROM character_info WHERE online >= 0'
      ).catch(() => ({ count: 0 }));

      // Get total guilds
      const guildsResult = await db.queryOne(
        'SELECT COUNT(*) as count FROM guild_list'
      ).catch(() => ({ count: 0 }));

      // Get top level player
      const topPlayerResult = await db.queryOne(
        `SELECT ci.name, ci.level, ci.reset, ci.race 
         FROM character_info ci 
         WHERE ci.online >= 0 
         ORDER BY ci.level DESC, ci.experience DESC 
         LIMIT 1`
      ).catch(() => null);

      // Get castle siege information - disabled due to missing table/columns
      const castleResult = null; // TODO: implement when castle siege tables are available

      // Update statistics with real data
      fallbackData.statistics = {
        playersOnline: onlineResult.count || 0,
        totalAccounts: accountsResult.count || 0,
        totalCharacters: charactersResult.count || 0,
        totalGuilds: guildsResult.count || 0,
        topPlayer: topPlayerResult ? {
          name: topPlayerResult.name,
          level: topPlayerResult.level,
          resets: topPlayerResult.reset || 0,
          characterClass: getClassNameById(topPlayerResult.race)
        } : null,
        castleOwner: castleResult ? {
          guildName: castleResult.guild_name,
          guildMaster: 'N/A'
        } : null
      };
    } catch (dbError) {
      console.error('Database error in server status (using fallback data):', dbError);
      // Continue with fallback data
    }

    res.json(fallbackData);

  } catch (error) {
    console.error('Server status error:', error);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

// Get detailed online players list
router.get('/online', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const query = `
      SELECT 
        ci.name,
        ci.level,
        ci.reset,
        ci.race,
        ci.last_use
      FROM character_info ci
      INNER JOIN accounts a ON ci.account_id = a.guid
      WHERE ci.online = 1
      ORDER BY ci.level DESC
      LIMIT ?
    `;

    const onlinePlayers = await db.query(query, [parseInt(limit)]);

    res.json({
      players: onlinePlayers.map(player => ({
        name: player.name,
        level: player.level,
        resets: player.reset || 0,
        characterClass: getClassNameById(player.race),
        guildName: 'None', // TODO: implement guild lookup when schema is clarified
        lastOnline: player.last_use
      })),
      count: onlinePlayers.length
    });

  } catch (error) {
    console.error('Online players error:', error);
    res.status(500).json({ error: 'Failed to fetch online players' });
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
