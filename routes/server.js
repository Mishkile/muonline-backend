const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Get server status information
router.get('/', async (req, res) => {
  try {
    // Default fallback data
    const serverData = {
      server: {
        name: "Mishki MU S19.2.3",
        season: "Season 19 Part 2-3",
        rates: {
          experience: "9999x",
          drop: "30%",
          zen: "9999x",
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
      statistics: {
        playersOnline: 0,
        totalAccounts: 0,
        totalCharacters: 0,
        totalGuilds: 0,
        topPlayer: null,
        castleOwner: "No Owner"
      },
      events: [
        {
          id: 1,
          title: "Server Launch",
          description: "Welcome to Mishki MU Season 19 Part 2-3!",
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

    // Try to get real statistics from database
    try {
      const connection = await db.getConnection();
      
      const [accountResult] = await connection.execute('SELECT COUNT(*) as total_accounts FROM accounts');
      const [characterResult] = await connection.execute('SELECT COUNT(*) as total_characters FROM character_info');
      const [onlineResult] = await connection.execute('SELECT COUNT(*) as online_players FROM character_info WHERE online = 1');
      const [guildResult] = await connection.execute('SELECT COUNT(*) as total_guilds FROM guild_list');
      const [topPlayerResult] = await connection.execute('SELECT name, level, reset FROM character_info ORDER BY level DESC, reset DESC LIMIT 1');
      
      connection.release();

      // Update with real data
      serverData.statistics = {
        playersOnline: onlineResult[0].online_players,
        totalAccounts: accountResult[0].total_accounts,
        totalCharacters: characterResult[0].total_characters,
        totalGuilds: guildResult[0].total_guilds,
        topPlayer: topPlayerResult[0] || null,
        castleOwner: "No Owner" // Default since we don't have castle siege data yet
      };
    } catch (dbError) {
      console.error('Database error in server status (using fallback data):', dbError);
      // Continue with fallback data - don't crash the server
    }

    res.json(serverData);

  } catch (error) {
    console.error('Server status error:', error);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

// Get detailed online players list
router.get('/online', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const connection = await db.getConnection();
    const [players] = await connection.execute(`
      SELECT 
        ci.name,
        ci.level,
        ci.level_master,
        ci.reset,
        ci.race,
        ci.world,
        ci.last_use
      FROM character_info ci
      WHERE ci.online = 1
      ORDER BY ci.level DESC, ci.reset DESC
      LIMIT ?
    `, [parseInt(limit)]);
    
    connection.release();

    const formattedPlayers = players.map(player => ({
      name: player.name,
      level: player.level,
      masterLevel: player.level_master || 0,
      resets: player.reset || 0,
      class: getCharacterClass(player.race),
      location: getMapName(player.world),
      lastActive: new Date(player.last_use * 1000).toISOString()
    }));

    res.json({
      players: formattedPlayers,
      total: formattedPlayers.length,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Online players error:', error);
    res.status(500).json({ error: 'Failed to fetch online players' });
  }
});

// Helper function to get character class name
function getCharacterClass(classId) {
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

// Helper function to get map name
function getMapName(mapId) {
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
    69: 'Imperial Guardian 1',
    70: 'Imperial Guardian 2',
    71: 'Imperial Guardian 3',
    72: 'Imperial Guardian 4',
    79: 'Loren Market',
    80: 'Karutan 1',
    81: 'Karutan 2'
  };
  
  return maps[mapId] || 'Unknown';
}

module.exports = router;
