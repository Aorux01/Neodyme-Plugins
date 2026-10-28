const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class DiscordIntegration {
    name = "discord-integration";
    version = "1.0.2";
    description = "Enhanced Discord integration features";
    author = "Aorux - Neodyme Team";
    minBackendVersion = "1.2.9";
    repository = "https://github.com/Aorux01/Neodyme-Plugins";
    homepage = "https://github.com/Aorux01/Neodyme-Plugins/blob/main/discord-integration/README.md";
    dependencies = {
        npm: ["discord.js"],
        plugins: []
    };

    constructor() {
        this.config = null;
        this.configPath = path.join(__dirname, 'config.json');
        this.client = null;
        this.pluginManager = null;
        this.LoggerService = null;
        this.DatabaseManager = null;
        this.ShopManager = null;
        this.startTime = null;
        this.restoreHooks = [];
    }

    async init(pluginManager) {
        try {
            this.pluginManager = pluginManager;
            this.startTime = new Date();

            this.LoggerService = require('../../src/service/logger/logger-service');
            this.DatabaseManager = require('../../src/manager/database-manager');

            this.loadConfig();

            if (!this.config.enabled) {
                this.LoggerService.log('info', '[Discord] Plugin disabled in config');
                return true;
            }

            if (this.config.webhooks.serverStatus.enabled && this.config.webhooks.serverStatus.url) {
                await this.sendServerStartWebhook();
            }

            if (this.config.bot.enabled && this.config.bot.token) {
                await this.initializeBot();
            }

            this.hookShopRotation();
            this.hookStaffAlerts();

            this.LoggerService.log('success', '[Discord] Plugin initialized successfully');
            return true;
        } catch (error) {
            if (this.LoggerService) {
                this.LoggerService.log('error', `[Discord] Failed to initialize: ${error.message}`);
            }
            console.error('[Discord] Failed to initialize:', error);
            return false;
        }
    }

    loadConfig() {
        try {
            const defaults = this.defaultConfig();
            if (fs.existsSync(this.configPath)) {
                this.config = this.merge(defaults, JSON.parse(fs.readFileSync(this.configPath, 'utf8')));
            } else {
                this.LoggerService.log('warn', '[Discord] Config file not found, creating default');
                this.config = defaults;
                this.saveConfig();
            }
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to load config: ${error.message}`);
            throw error;
        }
    }

    merge(base, extra) {
        const isPlain = (value) => value && typeof value === 'object' && !Array.isArray(value);
        if (!isPlain(base) || !isPlain(extra)) return extra === undefined ? base : extra;
        const result = { ...base };
        for (const [key, value] of Object.entries(extra)) {
            result[key] = this.merge(base[key], value);
        }
        return result;
    }

    defaultConfig() {
        return {
            enabled: true,
            webhooks: {
                serverStatus: { enabled: true, url: "", username: "Neodyme Server", avatarUrl: "" },
                shopRotation: { enabled: true, url: "", username: "Neodyme Shop", avatarUrl: "" },
                staffAlerts: { enabled: false, url: "", username: "Neodyme Staff", avatarUrl: "", events: { tickets: true, appeals: true, security: true } }
            },
            bot: {
                enabled: false,
                token: "",
                clientId: "",
                guildId: "",
                prefix: "!",
                maxVbucksPerCommand: 100000,
                roles: { admin: [], moderator: [], support: [] },
                commands: {
                    createAccount: { enabled: true, allowedRoles: ["admin", "moderator"] },
                    viewAccount: { enabled: true, allowedRoles: ["admin", "moderator", "support"] },
                    banUser: { enabled: true, allowedRoles: ["admin", "moderator"] },
                    unbanUser: { enabled: true, allowedRoles: ["admin", "moderator"] },
                    giveVbucks: { enabled: true, allowedRoles: ["admin"] },
                    serverStatus: { enabled: true, allowedRoles: [] },
                    playerCount: { enabled: true, allowedRoles: [] },
                    whoami: { enabled: true, allowedRoles: [] },
                    lookupMember: { enabled: true, allowedRoles: ["admin", "moderator", "support"] }
                }
            },
            embeds: {
                colors: {
                    success: "#00ff00", error: "#ff0000", info: "#0099ff",
                    warning: "#ffcc00", serverOnline: "#00ff00", serverOffline: "#ff0000",
                    shopRotation: "#9b59b6"
                },
                footer: { text: "Neodyme Server", iconUrl: "" },
                showTimestamp: true
            }
        };;
    }

    saveConfig() {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config || this.defaultConfig(), null, 4), 'utf8');
    }

    async sendWebhook(webhookUrl, payload, attachments = null) {
        return new Promise((resolve, reject) => {
            try {
                const url = new URL(webhookUrl);

                let body, headers;
                if (attachments && attachments.length > 0) {
                    // multipart/form-data: payload_json + files[N]
                    const boundary = '----NeodymeBoundary' + Date.now().toString(16);
                    const parts = [];

                    parts.push(Buffer.from(
                        `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="payload_json"\r\n` +
                        `Content-Type: application/json\r\n\r\n` +
                        JSON.stringify(payload) + `\r\n`
                    ));

                    attachments.forEach((att, i) => {
                        parts.push(Buffer.from(
                            `--${boundary}\r\n` +
                            `Content-Disposition: form-data; name="files[${i}]"; filename="${att.filename}"\r\n` +
                            `Content-Type: ${att.contentType || 'application/octet-stream'}\r\n\r\n`
                        ));
                        parts.push(Buffer.isBuffer(att.data) ? att.data : Buffer.from(att.data));
                        parts.push(Buffer.from('\r\n'));
                    });

                    parts.push(Buffer.from(`--${boundary}--\r\n`));
                    body = Buffer.concat(parts);
                    headers = {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': body.length
                    };
                } else {
                    body = Buffer.from(JSON.stringify(payload));
                    headers = {
                        'Content-Type': 'application/json',
                        'Content-Length': body.length
                    };
                }

                const options = {
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers
                };

                const protocol = url.protocol === 'https:' ? https : http;
                const req = protocol.request(options, (res) => {
                    let resBody = '';
                    res.on('data', chunk => resBody += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ success: true, statusCode: res.statusCode });
                        } else {
                            reject(new Error(`Webhook failed with status ${res.statusCode}: ${resBody}`));
                        }
                    });
                });

                req.on('error', reject);
                req.write(body);
                req.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    createEmbed(options) {
        const embed = {
            title: options.title || '',
            description: options.description || '',
            color: parseInt((options.color || this.config.embeds.colors.info).replace('#', ''), 16),
            fields: options.fields || []
        };

        if (this.config.embeds.showTimestamp) {
            embed.timestamp = new Date().toISOString();
        }

        if (this.config.embeds.footer.text) {
            embed.footer = {
                text: this.config.embeds.footer.text,
                icon_url: this.config.embeds.footer.iconUrl || undefined
            };
        }

        if (options.thumbnail) {
            embed.thumbnail = { url: options.thumbnail };
        }

        if (options.image) {
            embed.image = { url: options.image };
        }

        return embed;
    }

    async sendServerStartWebhook() {
        const webhook = this.config.webhooks.serverStatus;
        if (!webhook.url) return;

        const embed = this.createEmbed({
            title: 'Server Online',
            description: 'The Neodyme server has started successfully!',
            color: this.config.embeds.colors.serverOnline,
            fields: [
                { name: 'Status', value: 'Online', inline: true },
                { name: 'Started At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            ]
        });

        try {
            await this.sendWebhook(webhook.url, {
                username: webhook.username,
                avatar_url: webhook.avatarUrl || undefined,
                embeds: [embed]
            });
            this.LoggerService.log('info', '[Discord] Server start webhook sent');
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to send start webhook: ${error.message}`);
        }
    }

    async sendServerStopWebhook() {
        const webhook = this.config.webhooks.serverStatus;
        if (!webhook.url) return;

        const uptime = this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;

        const embed = this.createEmbed({
            title: 'Server Offline',
            description: 'The Neodyme server is shutting down.',
            color: this.config.embeds.colors.serverOffline,
            fields: [
                { name: 'Status', value: 'Offline', inline: true },
                { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true }
            ]
        });

        try {
            await this.sendWebhook(webhook.url, {
                username: webhook.username,
                avatar_url: webhook.avatarUrl || undefined,
                embeds: [embed]
            });
            this.LoggerService.log('info', '[Discord] Server stop webhook sent');
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to send stop webhook: ${error.message}`);
        }
    }

    formatShopData(shopData) {
        const categories = {};

        let shopConfig = { daily: {}, featured: {} };
        try {
            shopConfig = this.ShopManager.getShopConfig().shopCategories || shopConfig;
        } catch (e) {}

        for (const categoryKey of Object.keys(shopConfig)) {
            categories[categoryKey] = [];
        }

        for (const [key, value] of Object.entries(shopData)) {
            if (key === '//' || key.startsWith('//')) continue;

            for (const categoryKey of Object.keys(shopConfig)) {
                if (key.startsWith(categoryKey) && value.meta) {
                    categories[categoryKey].push({
                        name: value.meta.name || 'Unknown',
                        devName: key,
                        price: value.price || 0,
                        rarity: value.meta.rarity || 'Unknown',
                        type: value.meta.type || 'Unknown',
                        image: value.meta.image || null
                    });
                    break;
                }
            }
        }

        return { categories, shopConfig };
    }

    async generateShopImageSafe() {
        try {
            const ShopImageGenerator = require('../../src/service/shop/shop-image-generator');
            // Invalidate cache so the webhook always carries the freshest snapshot.
            if (typeof ShopImageGenerator.invalidateCache === 'function') {
                ShopImageGenerator.invalidateCache();
            }
            const svg = await ShopImageGenerator.generateShopImage();
            return svg || null;
        } catch (error) {
            this.LoggerService.log('warn', `[Discord] Shop image unavailable, will fall back to text: ${error.message}`);
            return null;
        }
    }

    async sendShopRotationWebhook(shopData) {
        const webhook = this.config.webhooks.shopRotation;
        if (!webhook.url || !webhook.enabled) return;

        // Try the image first; fall back to the legacy text summary if anything fails.
        const svg = await this.generateShopImageSafe();

        if (svg) {
            const filename = `shop-${new Date().toISOString().slice(0, 10)}.svg`;
            const embed = this.createEmbed({
                title: 'Shop Rotation Update',
                description: 'The item shop has been updated. See the attached preview.',
                color: this.config.embeds.colors.shopRotation,
                image: `attachment://${filename}`
            });

            try {
                await this.sendWebhook(webhook.url, {
                    username: webhook.username,
                    avatar_url: webhook.avatarUrl || undefined,
                    embeds: [embed],
                    attachments: [{ id: 0, filename, description: 'Shop preview' }]
                }, [{
                    filename,
                    data: Buffer.from(svg, 'utf8'),
                    contentType: 'image/svg+xml'
                }]);
                this.LoggerService.log('info', '[Discord] Shop rotation webhook sent (image)');
                return;
            } catch (error) {
                this.LoggerService.log('warn', `[Discord] Image webhook failed, falling back to text: ${error.message}`);
            }
        }

        // Fallback: legacy text summary.
        const fields = [];
        const { categories, shopConfig } = shopData;

        for (const [categoryKey, items] of Object.entries(categories)) {
            if (items && items.length > 0) {
                const categoryConfig = shopConfig[categoryKey] || {};
                const displayName = categoryConfig.displayName || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);

                const itemsList = items.slice(0, 5).map(item =>
                    `• ${item.name || item.devName || 'Unknown'} - ${item.price || '?'} V-Bucks`
                ).join('\n');

                fields.push({
                    name: `${displayName} Items`,
                    value: itemsList || 'None',
                    inline: false
                });
            }
        }

        const embed = this.createEmbed({
            title: 'Shop Rotation Update',
            description: 'The item shop has been updated with new items!',
            color: this.config.embeds.colors.shopRotation,
            fields
        });

        try {
            await this.sendWebhook(webhook.url, {
                username: webhook.username,
                avatar_url: webhook.avatarUrl || undefined,
                embeds: [embed]
            });
            this.LoggerService.log('info', '[Discord] Shop rotation webhook sent (text fallback)');
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to send shop webhook: ${error.message}`);
        }
    }

    hookShopRotation() {
        try {
            this.ShopManager = require('../../src/manager/shop-manager');
            const originalRotate = this.ShopManager.rotateShop;
            const rotate = originalRotate.bind(this.ShopManager);
            const self = this;

            this.ShopManager.rotateShop = async function(...args) {
                const result = await rotate(...args);
                try {
                    const shopData = await self.ShopManager.getShopData();
                    if (shopData) {
                        const formatted = self.formatShopData(shopData);
                        await self.sendShopRotationWebhook(formatted);
                    }
                } catch (e) {
                    self.LoggerService.log('error', `[Discord] Shop hook error: ${e.message}`);
                }
                return result;
            };
            this.restoreHooks.push(() => { this.ShopManager.rotateShop = originalRotate; });
            this.LoggerService.log('info', '[Discord] Shop rotation hook installed');
        } catch (error) {
            this.LoggerService.log('warn', `[Discord] Could not hook shop rotation: ${error.message}`);
        }
    }

    hookStaffAlerts() {
        const alerts = this.config.webhooks.staffAlerts;
        if (!alerts || !alerts.enabled || !alerts.url) return;

        try {
            const TicketService = require('../../src/service/api/ticket-service');
            const AuditService = require('../../src/service/api/audit-service');
            const events = alerts.events || {};

            const self = this;
            const wrap = (target, method, notify) => {
                const original = target[method];
                target[method] = async function (...args) {
                    const result = await original.apply(target, args);
                    notify(args, result).catch(error => {
                        self.LoggerService.log('warn', `[Discord] Staff alert failed: ${error.message}`);
                    });
                    return result;
                };
                this.restoreHooks.push(() => { target[method] = original; });
            };

            if (events.tickets) {
                wrap(TicketService, 'createTicket', async ([, displayName, subject, message, priority], result) => {
                    if (!result || !result.success) return;
                    await this.sendStaffAlert('New support ticket', this.config.embeds.colors.info, [
                        { name: 'Player', value: String(displayName), inline: true },
                        { name: 'Priority', value: String(priority || 'medium'), inline: true },
                        { name: 'Subject', value: String(subject).slice(0, 200) }
                    ]);
                });
            }

            if (events.appeals) {
                wrap(TicketService, 'createAppeal', async ([account], result) => {
                    if (!result || !result.success) return;
                    await this.sendStaffAlert('New ban appeal', this.config.embeds.colors.warning, [
                        { name: 'Player', value: String(account.displayName), inline: true },
                        { name: 'Ticket', value: String(result.ticketId), inline: true }
                    ]);
                });
            }

            if (events.security) {
                const watched = {
                    'security.2fa_forced_disable': 'Two-factor reset by staff',
                    'security.force_reset': 'Password reset required by staff',
                    'admin_password_reset': 'Password reset by an admin',
                    'force_logout': 'Sessions ended by staff'
                };
                wrap(AuditService, 'log', async ([action, , performedByName, , targetId]) => {
                    if (!watched[action]) return;
                    await this.sendStaffAlert(watched[action], this.config.embeds.colors.warning, [
                        { name: 'By', value: String(performedByName || 'unknown'), inline: true },
                        { name: 'Account', value: String(targetId || 'unknown'), inline: true }
                    ]);
                });
            }

            this.LoggerService.log('info', '[Discord] Staff alerts enabled');
        } catch (error) {
            this.LoggerService.log('warn', `[Discord] Could not enable staff alerts: ${error.message}`);
        }
    }

    async sendStaffAlert(title, color, fields) {
        const webhook = this.config.webhooks.staffAlerts;
        await this.sendWebhook(webhook.url, {
            username: webhook.username,
            avatar_url: webhook.avatarUrl || undefined,
            embeds: [this.createEmbed({ title, color, fields })]
        });
    }

    async audit(interaction, action, account, details = {}) {
        try {
            const AuditService = require('../../src/service/api/audit-service');
            await AuditService.log(action, `discord:${interaction.user.id}`, interaction.user.tag, 'account', account.accountId,
                { ...details, via: 'discord' }, null);
        } catch (_) {
            // an audit failure must not block the command
        }
    }

    async initializeBot() {
        try {
            let Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder;
            try {
                const discordjs = require('discord.js');
                Client = discordjs.Client;
                GatewayIntentBits = discordjs.GatewayIntentBits;
                REST = discordjs.REST;
                Routes = discordjs.Routes;
                SlashCommandBuilder = discordjs.SlashCommandBuilder;
            } catch (e) {
                this.LoggerService.log('warn', '[Discord] discord.js not installed. Run: npm install discord.js');
                this.LoggerService.log('warn', '[Discord] Bot features disabled. Webhooks will still work.');
                return;
            }

            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                    GatewayIntentBits.GuildMembers
                ]
            });

            await this.registerCommands(REST, Routes, SlashCommandBuilder);

            this.setupBotEvents();

            await this.client.login(this.config.bot.token);
            this.LoggerService.log('success', '[Discord] Bot logged in successfully');
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Bot initialization failed: ${error.message}`);
        }
    }

    async registerCommands(REST, Routes, SlashCommandBuilder) {
        const commands = [
            new SlashCommandBuilder()
                .setName('createaccount')
                .setDescription('Create a new account')
                .addStringOption(opt => opt.setName('email').setDescription('Email address').setRequired(true))
                .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
                .addStringOption(opt => opt.setName('password').setDescription('Password').setRequired(true)),

            new SlashCommandBuilder()
                .setName('viewaccount')
                .setDescription('View account information')
                .addStringOption(opt => opt.setName('username').setDescription('Username to look up').setRequired(true)),

            new SlashCommandBuilder()
                .setName('banuser')
                .setDescription('Ban a user')
                .addStringOption(opt => opt.setName('username').setDescription('Username to ban').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Ban reason').setRequired(false))
                .addStringOption(opt => opt.setName('duration').setDescription('Ban duration (e.g., 7d, 30d, permanent)').setRequired(false)),

            new SlashCommandBuilder()
                .setName('unbanuser')
                .setDescription('Unban a user')
                .addStringOption(opt => opt.setName('username').setDescription('Username to unban').setRequired(true)),

            new SlashCommandBuilder()
                .setName('givevbucks')
                .setDescription('Give V-Bucks to a user')
                .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of V-Bucks').setRequired(true)),

            new SlashCommandBuilder()
                .setName('serverstatus')
                .setDescription('View server status'),

            new SlashCommandBuilder()
                .setName('playercount')
                .setDescription('View current player count'),

            new SlashCommandBuilder()
                .setName('whoami')
                .setDescription('Show the Neodyme account linked to your Discord'),

            new SlashCommandBuilder()
                .setName('lookupmember')
                .setDescription('Show the Neodyme account linked to a Discord member')
                .addUserOption(opt => opt.setName('member').setDescription('Discord member').setRequired(true))
        ];

        const rest = new REST({ version: '10' }).setToken(this.config.bot.token);

        try {
            await rest.put(
                Routes.applicationGuildCommands(this.config.bot.clientId, this.config.bot.guildId),
                { body: commands.map(c => c.toJSON()) }
            );
            this.LoggerService.log('info', '[Discord] Slash commands registered');
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to register commands: ${error.message}`);
        }
    }

    setupBotEvents() {
        this.client.once('ready', () => {
            this.LoggerService.log('info', `[Discord] Bot ready as ${this.client.user.tag}`);
            this.client.user.setActivity('Neodyme Server', { type: 3 });
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleCommand(interaction);
        });

        this.client.on('error', error => {
            this.LoggerService.log('error', `[Discord] Bot error: ${error.message}`);
        });
    }

    hasPermission(member, commandName) {
        const cmdConfig = this.config.bot.commands[commandName];
        if (!cmdConfig || !cmdConfig.enabled) return false;

        if (!cmdConfig.allowedRoles || cmdConfig.allowedRoles.length === 0) return true;

        const roleConfig = this.config.bot.roles;
        for (const roleName of cmdConfig.allowedRoles) {
            const roleIds = roleConfig[roleName] || [];
            if (member.roles.cache.some(role => roleIds.includes(role.id))) {
                return true;
            }
        }

        return false;
    }

    async handleCommand(interaction) {
        const commandName = interaction.commandName.replace(/-/g, '');

        if (!this.hasPermission(interaction.member, commandName === 'createaccount' ? 'createAccount' :
            commandName === 'viewaccount' ? 'viewAccount' :
            commandName === 'banuser' ? 'banUser' :
            commandName === 'unbanuser' ? 'unbanUser' :
            commandName === 'givevbucks' ? 'giveVbucks' :
            commandName === 'serverstatus' ? 'serverStatus' :
            commandName === 'playercount' ? 'playerCount' :
            commandName === 'whoami' ? 'whoami' :
            commandName === 'lookupmember' ? 'lookupMember' : commandName)) {
            return interaction.reply({
                embeds: [this.createEmbed({
                    title: 'Permission Denied',
                    description: 'You do not have permission to use this command.',
                    color: this.config.embeds.colors.error
                })],
                ephemeral: true
            });
        }

        try {
            switch (commandName) {
                case 'createaccount':
                    await this.cmdCreateAccount(interaction);
                    break;
                case 'viewaccount':
                    await this.cmdViewAccount(interaction);
                    break;
                case 'banuser':
                    await this.cmdBanUser(interaction);
                    break;
                case 'unbanuser':
                    await this.cmdUnbanUser(interaction);
                    break;
                case 'givevbucks':
                    await this.cmdGiveVbucks(interaction);
                    break;
                case 'serverstatus':
                    await this.cmdServerStatus(interaction);
                    break;
                case 'playercount':
                    await this.cmdPlayerCount(interaction);
                    break;
                case 'whoami':
                    await this.cmdWhoAmI(interaction);
                    break;
                case 'lookupmember':
                    await this.cmdLookupMember(interaction);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown command', ephemeral: true });
            }
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Command error: ${error.message}`);
            const reply = interaction.deferred || interaction.replied ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
            await reply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: `An error occurred: ${error.message}`,
                    color: this.config.embeds.colors.error
                })],
                ephemeral: true
            });
        }
    }

    async cmdCreateAccount(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const email = interaction.options.getString('email');
        const username = interaction.options.getString('username');
        const password = interaction.options.getString('password');

        try {
            const Functions = require('../../src/service/api/functions-service');
            const problems = [];
            if (!Functions.isValidEmail(email)) problems.push('The email address is not valid.');
            if (!Functions.isValidUsername(username)) problems.push('The username must be 3 to 20 characters, start with a letter, and use only letters, digits and single underscores.');
            const strength = Functions.isValidPassword(password);
            if (!strength.valid) problems.push(...strength.errors);
            if (problems.length === 0 && await this.DatabaseManager.getAccountByDisplayName(username)) problems.push('That username is already taken.');

            if (problems.length > 0) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Account not created',
                        description: problems.join('\n'),
                        color: this.config.embeds.colors.error
                    })]
                });
            }

            const result = await this.DatabaseManager.createAccount(email, password, username);

            if (result.success || result.accountId) {
                await this.audit(interaction, 'discord.create_account', { accountId: result.accountId || 'unknown' }, { displayName: username });
                await interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Account Created',
                        description: `Account **${username}** created successfully!`,
                        color: this.config.embeds.colors.success,
                        fields: [
                            { name: 'Email', value: email, inline: true },
                            { name: 'Username', value: username, inline: true }
                        ]
                    })]
                });
            } else {
                await interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Failed',
                        description: result.message || 'Failed to create account',
                        color: this.config.embeds.colors.error
                    })]
                });
            }
        } catch (error) {
            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: error.message,
                    color: this.config.embeds.colors.error
                })]
            });
        }
    }

    async cmdViewAccount(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username');

        try {
            const clients = await this.DatabaseManager.getAllAccounts();
            const account = clients.find(c =>
                c.displayName && c.displayName.toLowerCase() === username.toLowerCase()
            );

            if (!account) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Not Found',
                        description: `Account **${username}** not found.`,
                        color: this.config.embeds.colors.error
                    })]
                });
            }

            const isBanned = await this.DatabaseManager.AccountIsBanned(account.accountId);
            const roleName = this.DatabaseManager.getRoleName(account.clientType || 0);

            const fields = [
                { name: 'Account ID', value: account.accountId || 'N/A', inline: false },
                { name: 'Display Name', value: account.displayName || 'N/A', inline: true },
                { name: 'Email', value: account.email || 'N/A', inline: true },
                { name: 'Role', value: roleName, inline: true },
                { name: 'Created', value: account.createdAt ? `<t:${Math.floor(new Date(account.createdAt).getTime() / 1000)}:R>` : 'N/A', inline: true },
                { name: 'Banned', value: isBanned ? 'Yes' : 'No', inline: true }
            ];

            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: `Account: ${account.displayName}`,
                    color: this.config.embeds.colors.info,
                    fields
                })]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: error.message,
                    color: this.config.embeds.colors.error
                })]
            });
        }
    }

    async cmdBanUser(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const duration = interaction.options.getString('duration') || 'permanent';

        try {
            const clients = await this.DatabaseManager.getAllAccounts();
            const account = clients.find(c =>
                c.displayName && c.displayName.toLowerCase() === username.toLowerCase()
            );

            if (!account) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Not Found',
                        description: `Account **${username}** not found.`,
                        color: this.config.embeds.colors.error
                    })]
                });
            }

            let banExpires = null;
            if (duration !== 'permanent') {
                const match = duration.match(/^(\d+)([dhm])$/);
                if (match) {
                    const value = parseInt(match[1]);
                    const unit = match[2];
                    const ms = unit === 'd' ? value * 86400000 :
                               unit === 'h' ? value * 3600000 :
                               value * 60000;
                    banExpires = new Date(Date.now() + ms).toISOString();
                }
            }

            const banReason = `${reason} (banned by ${interaction.user.tag})`;
            await this.DatabaseManager.banAccount(account.accountId, [banReason], banExpires);
            await this.audit(interaction, 'ban', account, { reason, duration, displayName: account.displayName });
            try {
                await require('../../src/service/api/recovery-service').revokeSessions(account.accountId);
            } catch (_) {
                // the ban is already in place; sessions also stop at the next token refresh
            }

            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'User Banned',
                    description: `**${username}** has been banned.`,
                    color: this.config.embeds.colors.success,
                    fields: [
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Duration', value: duration, inline: true },
                        { name: 'Banned By', value: interaction.user.tag, inline: true }
                    ]
                })]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: error.message,
                    color: this.config.embeds.colors.error
                })]
            });
        }
    }

    async cmdUnbanUser(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username');

        try {
            const clients = await this.DatabaseManager.getAllAccounts();
            const account = clients.find(c =>
                c.displayName && c.displayName.toLowerCase() === username.toLowerCase()
            );

            if (!account) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Not Found',
                        description: `Account **${username}** not found.`,
                        color: this.config.embeds.colors.error
                    })]
                });
            }

            const isBanned = await this.DatabaseManager.AccountIsBanned(account.accountId);
            if (!isBanned) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Not Banned',
                        description: `**${username}** is not banned.`,
                        color: this.config.embeds.colors.warning
                    })]
                });
            }

            await this.DatabaseManager.unbanAccount(account.accountId);
            await this.audit(interaction, 'unban', account, { displayName: account.displayName });

            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'User Unbanned',
                    description: `**${username}** has been unbanned.`,
                    color: this.config.embeds.colors.success
                })]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: error.message,
                    color: this.config.embeds.colors.error
                })]
            });
        }
    }

    async cmdGiveVbucks(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username');
        const amount = interaction.options.getInteger('amount');

        if (!Number.isInteger(amount) || amount < 1 || amount > this.config.bot.maxVbucksPerCommand) {
            return interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'Invalid amount',
                    description: `Choose a whole number between 1 and ${this.config.bot.maxVbucksPerCommand}.`,
                    color: this.config.embeds.colors.error
                })]
            });
        }

        try {
            const clients = await this.DatabaseManager.getAllAccounts();
            const account = clients.find(c =>
                c.displayName && c.displayName.toLowerCase() === username.toLowerCase()
            );

            if (!account) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Not Found',
                        description: `Account **${username}** not found.`,
                        color: this.config.embeds.colors.error
                    })]
                });
            }

            const result = await this.DatabaseManager.addVbucks(account.accountId, amount);

            if (result.success) {
                await this.audit(interaction, 'discord.give_vbucks', account, { amount, displayName: account.displayName });
                await interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'V-Bucks Added',
                        description: `Added **${amount}** V-Bucks to **${username}**`,
                        color: this.config.embeds.colors.success,
                        fields: [
                            { name: 'New Balance', value: `${result.newBalance || 'Unknown'} V-Bucks`, inline: true }
                        ]
                    })]
                });
            } else {
                await interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Failed',
                        description: result.message || 'Failed to add V-Bucks',
                        color: this.config.embeds.colors.error
                    })]
                });
            }
        } catch (error) {
            await interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: error.message,
                    color: this.config.embeds.colors.error
                })]
            });
        }
    }

    async cmdServerStatus(interaction) {
        const TestRegistry = require('../../src/service/test/test-registry');
        TestRegistry.loadBuiltInChecks();
        const results = await TestRegistry.runHealth({ maxAgeMs: 10000 });
        const failing = results.filter(r => r.status === 'error');
        const degraded = results.filter(r => r.status === 'degraded');

        const state = failing.length > 0 ? 'Outage' : degraded.length > 0 ? 'Degraded' : 'Operational';
        const color = failing.length > 0 ? this.config.embeds.colors.error : degraded.length > 0 ? this.config.embeds.colors.warning : this.config.embeds.colors.success;

        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        const fields = [
            { name: 'Status', value: state, inline: true },
            { name: 'Uptime', value: `${hours}h ${minutes}m`, inline: true },
            { name: 'Memory Usage', value: `${memMB} MB`, inline: true }
        ];
        if (failing.length + degraded.length > 0) {
            fields.push({ name: 'Affected', value: [...failing, ...degraded].map(r => r.name).slice(0, 8).join(', ') });
        }

        await interaction.reply({ embeds: [this.createEmbed({ title: 'Server Status', color, fields })] });
    }

    async cmdPlayerCount(interaction) {
        try {
            const clients = await this.DatabaseManager.getAllAccounts();
            const totalAccounts = clients.length;

            await interaction.reply({
                embeds: [this.createEmbed({
                    title: 'Player Statistics',
                    color: this.config.embeds.colors.info,
                    fields: [
                        { name: 'Total Accounts', value: `${totalAccounts}`, inline: true }
                    ]
                })]
            });
        } catch (error) {
            await interaction.reply({
                embeds: [this.createEmbed({
                    title: 'Error',
                    description: error.message,
                    color: this.config.embeds.colors.error
                })],
                ephemeral: true
            });
        }
    }

    async accountForDiscordUser(discordId) {
        const link = await this.DatabaseManager.findAccountLink('discord', discordId);
        return link ? await this.DatabaseManager.getAccount(link.accountId) : null;
    }

    async describeAccount(interaction, account, title) {
        const [banned, balance] = await Promise.all([
            this.DatabaseManager.AccountIsBanned(account.accountId),
            this.DatabaseManager.getVbucksBalance(account.accountId)
        ]);

        await interaction.editReply({
            embeds: [this.createEmbed({
                title,
                color: this.config.embeds.colors.info,
                fields: [
                    { name: 'Display Name', value: account.displayName || 'N/A', inline: true },
                    { name: 'V-Bucks', value: String(balance), inline: true },
                    { name: 'Banned', value: banned ? 'Yes' : 'No', inline: true },
                    { name: 'Account ID', value: account.accountId, inline: false }
                ]
            })]
        });
    }

    async cmdWhoAmI(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const account = await this.accountForDiscordUser(interaction.user.id);
        if (!account) {
            return interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'No account linked',
                    description: 'Link your Discord from the Security page of the website (Linked accounts), then try again.',
                    color: this.config.embeds.colors.warning
                })]
            });
        }

        await this.describeAccount(interaction, account, 'Your Neodyme account');
    }

    async cmdLookupMember(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.options.getUser('member');
        const account = await this.accountForDiscordUser(member.id);
        if (!account) {
            return interaction.editReply({
                embeds: [this.createEmbed({
                    title: 'No account linked',
                    description: `${member.tag} has not linked a Neodyme account.`,
                    color: this.config.embeds.colors.warning
                })]
            });
        }

        await this.describeAccount(interaction, account, `Account of ${member.tag}`);
    }

    async shutdown() {
        try {
            for (const restore of this.restoreHooks.splice(0)) restore();

            if (this.config?.webhooks?.serverStatus?.enabled && this.config?.webhooks?.serverStatus?.url) {
                await this.sendServerStopWebhook();
            }

            if (this.client) {
                this.client.destroy();
                this.LoggerService.log('info', '[Discord] Bot disconnected');
            }

            this.LoggerService.log('info', '[Discord] Plugin shut down');
        } catch (error) {
            if (this.LoggerService) {
                this.LoggerService.log('error', `[Discord] Shutdown error: ${error.message}`);
            }
        }
    }
}

module.exports = DiscordIntegration;


