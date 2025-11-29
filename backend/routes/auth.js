const express = require('express');
const axios = require('axios');
const router = express.Router();
const { client, CONFIG } = require('../bot/bot');

const DISCORD_API = 'https://discord.com/api';

// Updated Scopes and Redirect URI
// User requested: https://verify.khxzi.com/auth/discord/callback and http://localhost:3004/auth/discord/callback
// We will use the one configured in ENV or default to localhost for dev.
// Note: The user provided specific URLs in the prompt, we should try to match the path.
// The user asked for `/auth/discord/callback` but our route is mounted at `/auth`. 
// So if we have `router.get('/discord/callback')` inside `auth.js`, the full path is `/auth/discord/callback`.

router.get('/login', (req, res) => {
    const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://verify.khxzi.com/auth/discord/callback';
    const clientId = process.env.DISCORD_CLIENT_ID || '1444061578709303436';
    const scope = 'email identify guilds.join openid guilds';

    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
});

router.get('/discord/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3004/auth/discord/callback';

        // 1. Exchange Code for Token
        const tokenResponse = await axios.post(`${DISCORD_API}/oauth2/token`, new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID || '1444061578709303436',
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token } = tokenResponse.data;

        // 2. Get User Info
        const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        const user = userResponse.data;

        // 3. Handle Guild Join / Role Assignment
        await handleUserVerification(user.id, access_token);

        // 4. Redirect to Status Page (or success page)
        // For now, redirect to the verify page with session info as before, or a success page.
        const sessionData = Buffer.from(JSON.stringify({
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar
        })).toString('base64');

        res.redirect(`${process.env.BACKEND_BASE}/verify.html?session=${sessionData}`);

    } catch (error) {
        console.error('OAuth Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed: ' + (error.response?.data?.error_description || error.message));
    }
});

async function handleUserVerification(userId, accessToken) {
    try {
        // We need to find the guild that contains these roles. 
        // We need to find the guild that contains these roles.
        // Let's assume the bot is in the guild and we can find it by the role ID or just iterate guilds.
        // OR we use a config variable for Guild ID. 
        // Since we don't have it, we'll try to find the guild where the bot has these roles.

        // For now, let's try to find the guild from the client cache
        // The user gave role IDs: 1418691690494955600 (Verified), 1418691687923843194 (Unverified)
        // Usually Role ID is same as Guild ID for the @everyone role, but these are specific roles.
        // We will iterate client guilds to find one containing the role.

        let targetGuild = null;
        for (const [id, g] of client.guilds.cache) {
            try {
                const role = await g.roles.fetch(CONFIG.VERIFIED_ROLE_ID);
                if (role) {
                    targetGuild = g;
                    break;
                }
            } catch (e) { }
        }

        if (!targetGuild) {
            console.error('Target Guild not found for verification.');
            return;
        }

        // Check if member exists
        let member = await targetGuild.members.fetch(userId).catch(() => null);

        if (!member) {
            // User not in guild, try to add them using guilds.join
            console.log(`User ${userId} not in guild, attempting to join...`);
            try {
                member = await targetGuild.members.add(userId, {
                    accessToken: accessToken,
                    roles: [CONFIG.VERIFIED_ROLE_ID] // Add Verified role immediately
                });
                console.log(`User ${userId} added to guild with Verified role.`);
            } catch (joinError) {
                console.error(`Failed to add user ${userId} to guild:`, joinError);
            }
        } else {
            // User in guild, update roles
            console.log(`User ${userId} is in guild, updating roles...`);
            await member.roles.add(CONFIG.VERIFIED_ROLE_ID);
            await member.roles.remove(CONFIG.UNVERIFIED_ROLE_ID);
            console.log(`Roles updated for ${userId}.`);
        }

    } catch (error) {
        console.error('Error in handleUserVerification:', error);
    }
}

module.exports = router;
