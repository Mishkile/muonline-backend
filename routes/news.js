const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all news/events
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM news WHERE status = "published"';
    const countResult = await db.query(countQuery);
    const total = countResult[0].total;

    // Get news items
    const newsQuery = `
      SELECT 
        id,
        title,
        content,
        image_url,
        category,
        author,
        created_at,
        updated_at
      FROM news 
      WHERE status = 'published'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const news = await db.query(newsQuery, [limit, offset]);

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

// Get news by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const newsQuery = `
      SELECT 
        id,
        title,
        content,
        image_url,
        category,
        author,
        created_at,
        updated_at,
        views
      FROM news 
      WHERE id = ? AND status = 'published'
    `;

    const news = await db.query(newsQuery, [id]);

    if (news.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'News article not found'
      });
    }

    // Increment view count
    await db.query('UPDATE news SET views = views + 1 WHERE id = ?', [id]);
    news[0].views += 1;

    res.json({
      success: true,
      data: news[0]
    });
  } catch (error) {
    console.error('Error fetching news by ID:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch news article' 
    });
  }
});

// Get news categories
router.get('/categories/list', async (req, res) => {
  try {
    const categoriesQuery = `
      SELECT DISTINCT category 
      FROM news 
      WHERE status = 'published' AND category IS NOT NULL
      ORDER BY category
    `;

    const categories = await db.query(categoriesQuery);

    res.json({
      success: true,
      data: categories.map(cat => cat.category)
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch categories' 
    });
  }
});

// Get events (upcoming and recent)
router.get('/events/upcoming', async (req, res) => {
  try {
    const eventsQuery = `
      SELECT 
        id,
        title,
        description,
        start_date,
        end_date,
        event_type,
        rewards,
        image_url
      FROM events 
      WHERE status = 'active' AND end_date > NOW()
      ORDER BY start_date ASC
      LIMIT 10
    `;

    const events = await db.query(eventsQuery);

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch events' 
    });
  }
});

module.exports = router;
