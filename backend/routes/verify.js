const express = require('express');
const router = express.Router();
const { saveCode, getCode, deleteCode } = require('../db/store');
const { sendVerificationCode, sendVerifiedSuccess, CONFIG } = require('../bot/bot');
const { client } = require('../bot/bot');

// Send Verification Code
router.post('/send', async (req, res) => {
    try {
        const { discordId } = req.body;
        if (!discordId) return res.status(400).json({ error: 'Missing Discord ID' });

        // Check Cooldown (1 minute)
        const existing = getCode(discordId);
        if (existing && Date.now() - existing.lastSent < 60000) {
            const remaining = Math.ceil((60000 - (Date.now() - existing.lastSent)) / 1000);
            return res.status(429).json({ error: `Please wait ${remaining}s before resending.` });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Send DM via Bot
        const result = await sendVerificationCode(discordId, code);
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Save to DB (Expires in 5 mins)
        saveCode(discordId, {
            code,
            expiresAt: Date.now() + 5 * 60 * 1000,
            lastSent: Date.now()
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Send Code Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Check Verification Code
router.post('/check', async (req, res) => {
    try {
        const { discordId, code } = req.body;
        if (!discordId || !code) return res.status(400).json({ error: 'Missing data' });

        const record = getCode(discordId);

        if (!record) {
            return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
        }

        if (Date.now() > record.expiresAt) {
            return res.status(400).json({ error: 'Code expired. Please request a new one.' });
        }

        if (record.code !== code) {
            return res.status(400).json({ error: 'Invalid code.' });
        }

        // Code is valid! Assign Role
        const guild = client.guilds.cache.first(); // Or find by ID if multiple
        // Better: Find guild by CONFIG role
        let targetGuild = null;
        for (const [id, g] of client.guilds.cache) {
            try {
                if (await g.roles.fetch(CONFIG.VERIFIED_ROLE_ID)) {
                    targetGuild = g;
                    break;
                }
            } catch (e) { }
        }

        if (targetGuild) {
            const member = await targetGuild.members.fetch(discordId).catch(() => null);
            if (member) {
                await member.roles.add(CONFIG.VERIFIED_ROLE_ID);
                await member.roles.remove(CONFIG.UNVERIFIED_ROLE_ID);

                // Send Success DM
                await sendVerifiedSuccess(discordId);

                // Log Verification
                const { logVerification } = require('../bot/bot');
                await logVerification({ discordId, method: 'Code Verification', notes: 'Verified via Code' }, null, 'Approved');
            }
        }

        // Cleanup
        deleteCode(discordId);

        res.json({ success: true });

    } catch (error) {
        console.error('Check Code Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
