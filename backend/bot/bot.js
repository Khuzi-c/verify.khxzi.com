const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { updateRequest } = require('../db/store');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const CONFIG = {
    UNVERIFIED_ROLE_ID: '1418691687923843194',
    VERIFIED_ROLE_ID: '1418691690494955600',
    VERIFY_PANEL_CHANNEL_ID: '1418927251998904343',
    VERIFICATION_LOGS_CHANNEL_ID: '1419643571463651399',
    ADMIN_ROLE_ID: '1418550771426791535',
    PANEL_FOOTER_TEXT: '[Verification Panel](https://verify.khxzi.com)'
};

async function initBot() {
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        await ensureVerifyPanel();
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const { customId } = interaction;

        if (customId === 'verify_start') {
            return;
        }

        if (customId.startsWith('approve_') || customId.startsWith('reject_')) {
            await handleAdminAction(interaction);
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId.startsWith('manage_passport_')) {
            await handlePassportManagement(interaction);
        }
    });

    await client.login(process.env.BOT_TOKEN);
}

async function ensureVerifyPanel() {
    try {
        const channel = await client.channels.fetch(CONFIG.VERIFY_PANEL_CHANNEL_ID);
        if (!channel) {
            console.error('Verify panel channel not found!');
            return;
        }

        const messages = await channel.messages.fetch({ limit: 50 });
        const existingPanel = messages.find(m =>
            m.embeds.length > 0 &&
            m.embeds[0].footer &&
            m.embeds[0].footer.text === CONFIG.PANEL_FOOTER_TEXT
        );

        if (existingPanel) {
            console.log('Verify panel exists, updating...');
            const embed = new EmbedBuilder()
                .setTitle('Verify Now — Khxzi')
                .setDescription('Click the button below to sign in with Discord and start your verification process.')
                .setColor(0x5865F2)
                .setFooter({ text: CONFIG.PANEL_FOOTER_TEXT });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Verify Now')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://verify.khxzi.com')
                );

            await existingPanel.edit({ embeds: [embed], components: [row] });
            console.log('Verify panel updated.');
            return;
        }

        // Create new panel
        const embed = new EmbedBuilder()
            .setTitle('Verify Now — Khxzi')
            .setDescription('Click the button below to sign in with Discord and start your verification process.')
            .setColor(0x5865F2)
            .setFooter({ text: CONFIG.PANEL_FOOTER_TEXT });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Verify Now')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://verify.khxzi.com') // Frontend URL
            );

        await channel.send({ embeds: [embed], components: [row] });
        console.log('Posted new verify panel.');

    } catch (error) {
        console.error('Error ensuring verify panel:', error);
    }
}

async function handleAdminAction(interaction) {
    const { customId, member, user } = interaction;
    const [action, requestId] = customId.split('_');

    // Check Admin Role
    if (!member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // We need to fetch the request from DB to get the user ID
        const { getRequest, updateRequest } = require('../db/store');
        const request = getRequest(requestId);

        if (!request) {
            return interaction.editReply('Request not found.');
        }

        if (request.status !== 'pending') {
            return interaction.editReply(`Request is already ${request.status}.`);
        }

        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(request.discordId).catch(() => null);

        if (action === 'approve') {
            if (targetMember) {
                await targetMember.roles.add(CONFIG.VERIFIED_ROLE_ID);
                await targetMember.roles.remove(CONFIG.UNVERIFIED_ROLE_ID);
            }

            updateRequest(requestId, {
                status: 'approved',
                reviewerId: user.id,
                reviewerNote: 'Approved via Button'
            });

            await logVerification(request, user, 'Approved');
            await interaction.editReply('Request approved successfully.');

            // Update the original message to show it's handled
            const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
            disabledRow.components.forEach(c => c.setDisabled(true));
            await interaction.message.edit({ components: [disabledRow] });

        } else if (action === 'reject') {
            updateRequest(requestId, {
                status: 'rejected',
                reviewerId: user.id,
                reviewerNote: 'Rejected via Button'
            });

            await logVerification(request, user, 'Rejected');
            await interaction.editReply('Request rejected.');

            // Update the original message
            const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
            disabledRow.components.forEach(c => c.setDisabled(true));
            await interaction.message.edit({ components: [disabledRow] });
        }

    } catch (error) {
        console.error('Error handling admin action:', error);
        await interaction.editReply('An error occurred while processing the request.');
    }
}

async function logVerification(request, reviewer, action) {
    const channel = await client.channels.fetch(CONFIG.VERIFICATION_LOGS_CHANNEL_ID);
    if (!channel) return;

    const guild = channel.guild;
    const member = await guild.members.fetch(request.discordId).catch(() => null);

    // Calculate Stats
    const { getRequests } = require('../db/store');
    const allRequests = getRequests().filter(r => r.discordId === request.discordId);
    const attempts = allRequests.length || 1;

    const joinedText = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';
    const userTag = member ? member.user.tag : 'Unknown';

    const embed = new EmbedBuilder()
        .setTitle(`Passport: ${action === 'Approved' ? 'Success' : 'Failed'}`)
        .setColor(action === 'Approved' ? 0x00FF00 : 0xFF0000)
        .setThumbnail(member ? member.user.displayAvatarURL({ dynamic: true }) : null)
        .setDescription(`
<:reply:112233445566778899> User: <@${request.discordId}> \`${request.discordId}\`
<:reply:112233445566778899> Joined: ${joinedText}
<:reply_end:112233445566778899> Attempts: ${attempts} tries
        `.replace(/<:reply:112233445566778899>/g, '├─').replace(/<:reply_end:112233445566778899>/g, '└─'))
    // Using standard chars as fallback if emojis fail, but formatting as description

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`manage_passport_${request.discordId}`)
        .setPlaceholder('Manage passport verification overrides.')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Unverify User Passport')
                .setDescription('Revoke verification status')
                .setValue('unverify')
                .setEmoji('🚫')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await channel.send({ embeds: [embed], components: [row] });
}

async function handlePassportManagement(interaction) {
    const userId = interaction.customId.split('_')[2];
    const action = interaction.values[0];

    if (!interaction.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
    }

    if (action === 'unverify') {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member) {
            try {
                await member.roles.remove(CONFIG.VERIFIED_ROLE_ID);
                await member.roles.add(CONFIG.UNVERIFIED_ROLE_ID);
                await interaction.reply({ content: `Successfully unverified <@${userId}>.`, ephemeral: true });
            } catch (err) {
                await interaction.reply({ content: `Failed to unverify: ${err.message}`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: 'User not found in server.', ephemeral: true });
        }
    }
}

async function sendVerificationRequestLog(request) {
    console.log(`[DEBUG] Attempting to send log for request ${request.id} to channel ${CONFIG.VERIFICATION_LOGS_CHANNEL_ID}`);
    try {
        const channel = await client.channels.fetch(CONFIG.VERIFICATION_LOGS_CHANNEL_ID);
        if (!channel) {
            console.error(`[ERROR] Verification logs channel not found! ID: ${CONFIG.VERIFICATION_LOGS_CHANNEL_ID}`);
            return;
        }
        console.log(`[DEBUG] Found channel: ${channel.name}`);

        const guild = channel.guild;
        const member = await guild.members.fetch(request.discordId).catch(() => null);

        // Calculate Stats
        const { getRequests } = require('../db/store');
        const allRequests = getRequests().filter(r => r.discordId === request.discordId);
        const attempts = allRequests.length;
        const failed = allRequests.filter(r => r.status === 'rejected').length;

        const joinedText = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Passport: Verification Request')
            .setColor(0xFFA500) // Orange for Pending
            .setThumbnail(member ? member.user.displayAvatarURL({ dynamic: true }) : null)
            .addFields(
                { name: 'User', value: `<@${request.discordId}>`, inline: true },
                { name: 'Id', value: request.discordId, inline: true },
                { name: 'Joined', value: joinedText, inline: true },
                { name: 'Failed', value: `${failed} times`, inline: true },
                { name: 'Attempts', value: `${attempts} tries`, inline: true },
                { name: 'Method', value: request.method || 'N/A', inline: false },
                { name: 'Notes', value: request.notes || 'None', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Request ID: ${request.id}` });

        if (request.attachments && request.attachments.length > 0) {
            const links = request.attachments.map((f, i) => `[Attachment ${i + 1}](${process.env.BACKEND_BASE}/uploads/${f})`).join('\n');
            embed.addFields({ name: 'Attachments', value: links });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_${request.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_${request.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

        await channel.send({ embeds: [embed], components: [row] });
        console.log('[DEBUG] Verification log sent successfully.');
    } catch (error) {
        console.error('[ERROR] Failed to send verification log:', error);
    }
}

async function sendVerificationCode(userId, code) {
    try {
        const user = await client.users.fetch(userId);
        if (!user) return { success: false, error: 'User not found' };

        const embed = new EmbedBuilder()
            .setTitle('Verification Code')
            .setDescription(`Your verification code is:\n# ${code}\n\nPlease enter this code on the website to complete your verification.`)
            .setColor(0x5865F2)
            .setFooter({ text: 'This code expires in 5 minutes.' });

        await user.send({ embeds: [embed] });
        return { success: true };
    } catch (error) {
        console.error(`Failed to send DM to ${userId}:`, error);
        return { success: false, error: 'Could not send DM. Please open your DMs.' };
    }
}

async function sendVerifiedSuccess(userId) {
    try {
        const user = await client.users.fetch(userId);
        if (!user) return;

        const embed = new EmbedBuilder()
            .setTitle('🎉 Verified Successfully!')
            .setDescription('Congratulations, you have been verified! You now have access to the server.')
            .setColor(0x00FF00);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Go to Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/THbZwYpsJs')
            );

        await user.send({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error(`Failed to send success DM to ${userId}:`, error);
    }
}

module.exports = { initBot, client, sendVerificationRequestLog, sendVerificationCode, sendVerifiedSuccess, logVerification, CONFIG };
