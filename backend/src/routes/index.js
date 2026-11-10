// Collects all API routes under /api.
const express = require('express');
const authRoutes = require('./authRoutes');
const farmRoutes = require('./farmRoutes');

const router = express.Router();

// Simple check that the API is running (no login needed).
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'PoultryStart API is running.' });
});

router.use('/auth', authRoutes);
router.use('/farms', farmRoutes);

module.exports = router;
