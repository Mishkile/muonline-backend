// Database helper functions to handle different table schemas
const db = require('../config/database');

// Try multiple table schemas for character information
async function getCharacterInfo(name) {
  // Try character_info table first (most common)
  try {
    const query1 = `
      SELECT 
        ci.name,
        ci.level,
        ci.experience,
        ci.reset,
        ci.level_master,
        ci.experience_master,
        ci.race,
        ci.strength,
        ci.agility as dexterity,
        ci.vitality,
        ci.energy,
        ci.leadership,
        ci.life,
        ci.mana,
        ci.points as level_up_point,
        ci.money,
        ci.pk_count,
        ci.pk_level,
        0 as pk_time,
        ci.world as map_number,
        ci.world_x as map_pos_x,
        ci.world_y as map_pos_y,
        ci.direction as map_dir,
        ci.account_id,
        ci.online
      FROM character_info ci
      WHERE ci.name = ? AND ci.online >= 0
    `;
    
    const result = await db.queryOne(query1, [name]);
    if (result) return result;
  } catch (error) {
    console.log('character_info table query failed, trying alternatives...', error.message);
  }

  // Try character table as fallback
  try {
    const query2 = `
      SELECT 
        c.name,
        c.clevel as level,
        c.experience,
        c.resets as reset,
        c.master_level as level_master,
        c.master_experience as experience_master,
        c.cclass as race,
        c.strength,
        c.dexterity,
        c.vitality,
        c.energy,
        c.leadership,
        c.life,
        c.mana,
        c.level_up_point,
        c.money,
        c.pkcount as pk_count,
        c.pklevel as pk_level,
        c.pktime as pk_time,
        c.map_number,
        c.map_pos_x,
        c.map_pos_y,
        c.map_dir,
        c.account_id,
        1 as online
      FROM character c
      WHERE c.name = ? AND c.ctl_code = 0
    `;
    
    const result = await db.queryOne(query2, [name]);
    if (result) return result;
  } catch (error) {
    console.log('character table not found or query failed');
  }

  return null;
}

// Try multiple table schemas for guild information
async function getGuildInfo(characterName) {
  // Try guild_members + guild_list first
  try {
    const query1 = `
      SELECT 
        gl.name as guild_name,
        ci_master.name as guild_master
      FROM guild_members gm
      INNER JOIN guild_list gl ON gm.guild_id = gl.guid
      INNER JOIN character_info ci ON gm.char_id = ci.guid
      LEFT JOIN guild_members gm_master ON gl.guid = gm_master.guild_id AND gm_master.ranking = 0
      LEFT JOIN character_info ci_master ON gm_master.char_id = ci_master.guid
      WHERE ci.name = ?
    `;
    
    const result = await db.queryOne(query1, [characterName]);
    if (result && result.guild_name) return result;
  } catch (error) {
    console.log('guild_members table query failed, trying simpler approach...', error.message);
  }

  // Try simple guild lookup without master info
  try {
    const query2 = `
      SELECT 
        gl.name as guild_name,
        'Unknown' as guild_master
      FROM guild_members gm
      INNER JOIN guild_list gl ON gm.guild_id = gl.guid
      INNER JOIN character_info ci ON gm.char_id = ci.guid
      WHERE ci.name = ?
    `;
    
    const result = await db.queryOne(query2, [characterName]);
    if (result && result.guild_name) return result;
  } catch (error) {
    console.log('Simple guild lookup failed', error.message);
  }

  return null;
}

// Get all characters with guild info for rankings
async function getCharactersForRankings(orderBy, whereClause, limit, offset) {
  // Try character_info first
  try {
    const query1 = `
      SELECT 
        ci.name,
        ci.level,
        ci.experience,
        ci.reset,
        ci.level_master,
        ci.experience_master,
        ci.race,
        ci.pk_count,
        ci.pk_level,
        a.account as account_name,
        COALESCE(gl.name, 'None') as guild_name
      FROM character_info ci
      INNER JOIN accounts a ON ci.account_id = a.guid
      LEFT JOIN guild_members gm ON ci.guid = gm.char_id
      LEFT JOIN guild_list gl ON gm.guild_id = gl.guid
      WHERE ci.online >= 0 ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const result = await db.query(query1, [limit, offset]);
    if (result && result.length > 0) return result;
  } catch (error) {
    console.log('character_info table not found for rankings, trying alternatives...', error.message);
  }

  // Try character table as fallback
  try {
    const query2 = `
      SELECT 
        c.name,
        c.clevel as level,
        c.experience,
        c.resets as reset,
        c.master_level as level_master,
        c.master_experience as experience_master,
        c.cclass as race,
        c.pkcount as pk_count,
        c.pklevel as pk_level,
        a.account as account_name,
        'None' as guild_name
      FROM character c
      INNER JOIN accounts a ON c.account_id = a.guid
      WHERE c.ctl_code = 0
      ORDER BY ${orderBy.replace(/ci\./g, 'c.')}
      LIMIT ? OFFSET ?
    `;
    
    const result = await db.query(query2, [limit, offset]);
    return result || [];
  } catch (error) {
    console.log('character table not found for rankings');
    return [];
  }
}

// Get total character count for pagination
async function getCharacterCount(whereClause = '') {
  try {
    const query1 = `
      SELECT COUNT(*) as total
      FROM character_info ci
      INNER JOIN accounts a ON ci.account_id = a.guid
      WHERE ci.online >= 0 ${whereClause}
    `;
    
    const result = await db.queryOne(query1);
    if (result) return result.total;
  } catch (error) {
    console.log('character_info table not found for count, trying alternatives...', error.message);
  }

  try {
    const query2 = `
      SELECT COUNT(*) as total
      FROM character c
      INNER JOIN accounts a ON c.account_id = a.guid
      WHERE c.ctl_code = 0
    `;
    
    const result = await db.queryOne(query2);
    return result ? result.total : 0;
  } catch (error) {
    console.log('character table not found for count');
    return 0;
  }
}

module.exports = {
  getCharacterInfo,
  getGuildInfo,
  getCharactersForRankings,
  getCharacterCount
};
