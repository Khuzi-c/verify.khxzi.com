require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { initBot } = require('./bot/bot');
const authRoutes = require('./routes/auth');
const verifyRoutes = require('./routes/verify');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files
app.use(express.static(path.join(__dirname, '../frontend/dist'))); // Serve frontend build

// Routes
app.use('/auth', authRoutes);
app.use('/api/verify', verifyRoutes);

// Serve Frontend for all other routes (SPA support)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start Bot and Server
initBot().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start bot:', err);
});
