require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const connectDB = require('./config/db');
require('./config/redis');

// Route imports
const adminRoutes = require('./routes/adminRoutes');
const dailyQuoteRoutes = require('./routes/dailyQuoteRoutes');
const naamJapRoutes = require('./routes/naamJapRoutes');
const homeContentRoutes = require('./routes/homeContentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const presetImageRoutes = require('./routes/presetImageRoutes');
const stepTrackerRoutes = require('./routes/stepTrackerRoutes');
const appVersionRoutes = require('./routes/appVersionRoutes');
const donationRoutes = require('./routes/donationRoutes');
const handwrittenNaamRoutes = require('./routes/handwrittenNaamRoutes');
const handwrittenAdminRoutes = require('./routes/handwrittenAdminRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const referralRoutes = require('./routes/referralRoutes');
const gameRoutes = require('./routes/gameRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '4.5mb' }));
app.use(express.urlencoded({ limit: '4.5mb', extended: true }));

// Light ETag support on JSON responses
app.set('etag', 'strong');

// Liveness does not depend on the database, so infrastructure can verify
// the process even if MongoDB is temporarily unavailable.
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Shree Jii API Server is running',
        timestamp: new Date().toISOString()
    });
});

// Database connection middleware for serverless
const dbMiddleware = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Unable to connect to database. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Apply DB middleware only after the liveness endpoint.
app.use('/api', dbMiddleware);

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/daily-quotes', dailyQuoteRoutes);
app.use('/api/naam-jap', naamJapRoutes);
app.use('/api/home-content', homeContentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/preset-images', presetImageRoutes);
app.use('/api/step-tracker', stepTrackerRoutes);
app.use('/api/app-version', appVersionRoutes);
app.use('/api/donation', donationRoutes);
app.use('/api/handwritten-naam', handwrittenAdminRoutes);
app.use('/api/handwritten-naam', handwrittenNaamRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/games', gameRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({ success: true, message: 'Shree Jii API Server' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });
});

// Only start server if not in serverless environment
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, HOST, () => {
        console.log(`Shree Jii Server running on http://${HOST}:${PORT}`);
    });
}

module.exports = app;
