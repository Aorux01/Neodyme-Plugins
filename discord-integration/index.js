const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class DiscordIntegration {
    name = "DiscordIntegration";
    version = "1.0.0";
    description = "Discord bot and webhook integration for Neodyme server";
    author = "Aorux - Neodyme Team";
    minBackendVersion = "1.2.0";
    dependencies = [];

    constructor() {
        this.config = null;
        this.configPath = path.join(__dirname, 'config.json');
        this.client = null;
        this.pluginManager = null;
        this.LoggerService = null;
        this.DatabaseManager = null;
        this.ShopManager = null;
        this.startTime = null;
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
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(data);
            } else {
                this.LoggerService.log('warn', '[Discord] Config file not found, creating default');
                this.saveConfig();
            }
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to load config: ${error.message}`);
            throw error;
        }
    }

    saveConfig() {
        const defaultConfig = {
            enabled: true,
            webhooks: {
                serverStatus: { enabled: true, url: "", username: "Neodyme Server", avatarUrl: "" },
                shopRotation: { enabled: true, url: "", username: "Neodyme Shop", avatarUrl: "" }
            },
            bot: {
                enabled: false,
                token: "",
                clientId: "",
                guildId: "",
                prefix: "!",
                roles: { admin: [], moderator: [], support: [] },
                commands: {
                    createAccount: { enabled: true, allowedRoles: ["admin", "moderator"] },
                    viewAccount: { enabled: true, allowedRoles: ["admin", "moderator", "support"] },
                    banUser: { enabled: true, allowedRoles: ["admin", "moderator"] },
                    unbanUser: { enabled: true, allowedRoles: ["admin", "moderator"] },
                    giveVbucks: { enabled: true, allowedRoles: ["admin"] },
                    serverStatus: { enabled: true, allowedRoles: [] },
                    playerCount: { enabled: true, allowedRoles: [] }
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
        };
        this.config = defaultConfig;
        fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');
    }

    async sendWebhook(webhookUrl, payload) {
        return new Promise((resolve, reject) => {
            try {
                const url = new URL(webhookUrl);
                const data = JSON.stringify(payload);

                const options = {
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data)
                    }
                };

                const protocol = url.protocol === 'https:' ? https : http;
                const req = protocol.request(options, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ success: true, statusCode: res.statusCode });
                        } else {
                            reject(new Error(`Webhook failed with status ${res.statusCode}: ${body}`));
                        }
                    });
                });

                req.on('error', reject);
                req.write(data);
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
        const featured = [];
        const daily = [];

        for (const [key, value] of Object.entries(shopData)) {
            if (key === '//') continue;

            if (key.startsWith('featured') && value.meta) {
                featured.push({
                    name: value.meta.name || 'Unknown',
                    devName: key,
                    price: value.price || 0,
                    rarity: value.meta.rarity || 'Unknown',
                    type: value.meta.type || 'Unknown',
                    image: value.meta.image || null
                });
            } else if (key.startsWith('daily') && value.meta) {
                daily.push({
                    name: value.meta.name || 'Unknown',
                    devName: key,
                    price: value.price || 0,
                    rarity: value.meta.rarity || 'Unknown',
                    type: value.meta.type || 'Unknown',
                    image: value.meta.image || null
                });
            }
        }

        return { featured, daily };
    }

    async sendShopRotationWebhook(shopData) {
        const webhook = this.config.webhooks.shopRotation;
        if (!webhook.url || !webhook.enabled) return;

        const fields = [];

        if (shopData.featured && shopData.featured.length > 0) {
            const featuredItems = shopData.featured.slice(0, 5).map(item =>
                `• ${item.name || item.devName || 'Unknown'} - ${item.price || '?'} V-Bucks`
            ).join('\n');
            fields.push({ name: 'Featured Items', value: featuredItems || 'None', inline: false });
        }

        if (shopData.daily && shopData.daily.length > 0) {
            const dailyItems = shopData.daily.slice(0, 5).map(item =>
                `• ${item.name || item.devName || 'Unknown'} - ${item.price || '?'} V-Bucks`
            ).join('\n');
            fields.push({ name: 'Daily Items', value: dailyItems || 'None', inline: false });
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
            this.LoggerService.log('info', '[Discord] Shop rotation webhook sent');
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Failed to send shop webhook: ${error.message}`);
        }
    }

    hookShopRotation() {
        try {
            this.ShopManager = require('../../src/manager/shop-manager');
            const originalRotate = this.ShopManager.rotateShop.bind(this.ShopManager);
            const self = this;

            this.ShopManager.rotateShop = async function(...args) {
                const result = await originalRotate(...args);
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
            this.LoggerService.log('info', '[Discord] Shop rotation hook installed');
        } catch (error) {
            this.LoggerService.log('warn', `[Discord] Could not hook shop rotation: ${error.message}`);
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
                .setDescription('View current player count')
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
        this.client.on('ready', () => {
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
            commandName === 'playercount' ? 'playerCount' : commandName)) {
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
                default:
                    await interaction.reply({ content: 'Unknown command', ephemeral: true });
            }
        } catch (error) {
            this.LoggerService.log('error', `[Discord] Command error: ${error.message}`);
            await interaction.reply({
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
            const result = await this.DatabaseManager.createAccount(email, username, password);

            if (result.success || result.accountId) {
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
            const clients = await this.DatabaseManager.getClients();
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

            const fields = [
                { name: 'Account ID', value: account.accountId || 'N/A', inline: false },
                { name: 'Display Name', value: account.displayName || 'N/A', inline: true },
                { name: 'Email', value: account.email || 'N/A', inline: true },
                { name: 'Role', value: account.role || 'player', inline: true },
                { name: 'Created', value: account.createdAt ? `<t:${Math.floor(new Date(account.createdAt).getTime() / 1000)}:R>` : 'N/A', inline: true },
                { name: 'Banned', value: account.ban?.banned ? 'Yes' : 'No', inline: true }
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
            const clients = await this.DatabaseManager.getClients();
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

            account.ban = {
                banned: true,
                reason,
                bannedAt: new Date().toISOString(),
                bannedBy: interaction.user.tag,
                banExpires
            };

            await this.DatabaseManager.saveClients(clients);

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
            const clients = await this.DatabaseManager.getClients();
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

            if (!account.ban?.banned) {
                return interaction.editReply({
                    embeds: [this.createEmbed({
                        title: 'Not Banned',
                        description: `**${username}** is not banned.`,
                        color: this.config.embeds.colors.warning
                    })]
                });
            }

            account.ban = { banned: false };
            await this.DatabaseManager.saveClients(clients);

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

        try {
            const clients = await this.DatabaseManager.getClients();
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
        const uptime = this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;

        const memUsage = process.memoryUsage();
        const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        await interaction.reply({
            embeds: [this.createEmbed({
                title: 'Server Status',
                color: this.config.embeds.colors.info,
                fields: [
                    { name: 'Status', value: 'Online', inline: true },
                    { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
                    { name: 'Memory Usage', value: `${memMB} MB`, inline: true },
                    { name: 'Node Version', value: process.version, inline: true }
                ]
            })]
        });
    }

    async cmdPlayerCount(interaction) {
        try {
            const clients = await this.DatabaseManager.getClients();
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

    async shutdown() {
        try {
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

