const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get guild by name
router.get('/:guildName', async (req, res) => {
  try {
    const { guildName } = req.params;

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
        g.created_date
      FROM guild g
      WHERE g.guild_name = ?
    `;

    const guild = await db.query(guildQuery, [guildName]);

    if (guild.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found'
      });
    }

    // Get guild members
    const membersQuery = `
      SELECT 
        gm.character_name,
        gm.guild_position,
        gm.guild_status,
        c.character_level,
        c.character_class,
        c.character_experience,
        c.pk_count,
        c.pk_level,
        c.last_login,
        c.total_kill_count,
        c.total_death_count
      FROM guild_member gm
      INNER JOIN characters c ON gm.character_name = c.character_name
      WHERE gm.guild_name = ?
      ORDER BY 
        CASE gm.guild_position 
          WHEN 0 THEN 0  -- Guild Master
          WHEN 1 THEN 1  -- Sub Master
          WHEN 2 THEN 2  -- Battle Master
          ELSE 3         -- Normal Member
        END,
        c.character_level DESC
    `;

    const members = await db.query(membersQuery, [guildName]);

    // Get guild statistics
    const statsQuery = `
      SELECT 
        COUNT(gm.character_name) as total_members,
        AVG(c.character_level) as average_level,
        MAX(c.character_level) as highest_level,
        SUM(c.total_kill_count) as total_kills,
        SUM(c.total_death_count) as total_deaths
      FROM guild_member gm
      INNER JOIN characters c ON gm.character_name = c.character_name
      WHERE gm.guild_name = ?
    `;

    const stats = await db.query(statsQuery, [guildName]);

    res.json({
      success: true,
      data: {
        guild: guild[0],
        members: members,
        statistics: stats[0]
      }
    });
  } catch (error) {
    console.error('Error fetching guild:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch guild information' 
    });
  }
});

// Get guild rankings
router.get('/rankings/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const orderBy = req.query.orderBy || 'guild_score';

    let validOrderColumns = ['guild_score', 'guild_level', 'member_count', 'average_level'];
    
    if (!validOrderColumns.includes(orderBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order column'
      });
    }

    const rankingsQuery = `
      SELECT 
        g.guild_name,
        g.guild_master,
        g.guild_mark,
        g.guild_score,
        g.guild_level,
        g.alliance_guild,
        g.union_name,
        COUNT(gm.character_name) as member_count,
        AVG(c.character_level) as average_level,
        MAX(c.character_level) as highest_level
      FROM guild g
      LEFT JOIN guild_member gm ON g.guild_name = gm.guild_name
      LEFT JOIN characters c ON gm.character_name = c.character_name
      GROUP BY g.guild_name
      ORDER BY ${orderBy} DESC
      LIMIT ?
    `;

    const rankings = await db.query(rankingsQuery, [limit]);

    res.json({
      success: true,
      data: rankings
    });
  } catch (error) {
    console.error('Error fetching guild rankings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch guild rankings' 
    });
  }
});

// Search guilds
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const searchQuery = `
      SELECT 
        g.guild_name,
        g.guild_master,
        g.guild_score,
        g.guild_level,
        COUNT(gm.character_name) as member_count
      FROM guild g
      LEFT JOIN guild_member gm ON g.guild_name = gm.guild_name
      WHERE g.guild_name LIKE ? OR g.guild_master LIKE ?
      GROUP BY g.guild_name
      ORDER BY g.guild_score DESC
      LIMIT ?
    `;

    const searchPattern = `%${query}%`;
    const results = await db.query(searchQuery, [searchPattern, searchPattern, limit]);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error searching guilds:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search guilds' 
    });
  }
});

// Get guild wars (if available in database)
router.get('/wars/active', async (req, res) => {
  try {
    // This endpoint assumes you have a guild_wars table
    // Adjust according to your actual database schema
    const warsQuery = `
      SELECT 
        gw.guild1_name,
        gw.guild2_name,
        gw.war_type,
        gw.start_time,
        gw.end_time,
        gw.guild1_score,
        gw.guild2_score,
        gw.status
      FROM guild_wars gw
      WHERE gw.status = 'active' OR gw.status = 'scheduled'
      ORDER BY gw.start_time ASC
    `;

    const wars = await db.query(warsQuery);

    res.json({
      success: true,
      data: wars
    });
  } catch (error) {
    // If guild_wars table doesn't exist, return empty array
    console.log('Guild wars table not available:', error.message);
    res.json({
      success: true,
      data: [],
      message: 'Guild wars feature not available'
    });
  }
});

module.exports = router;
