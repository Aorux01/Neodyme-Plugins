const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;

class DailyBonus {
    name = "daily-bonus";
    version = "1.0.0";
    description = "Daily sign-in bonus in V-Bucks with a streak";
    author = "Aorux - Neodyme Team";
    minBackendVersion = "1.2.9";
    repository = "https://github.com/Aorux01/Neodyme-Plugins";
    homepage = "https://github.com/Aorux01/Neodyme-Plugins/blob/main/daily-bonus/README.md";
    dependencies = {
        npm: [],
        plugins: []
    };

    constructor() {
        this.configPath = path.join(__dirname, 'config.json');
        this.dataPath = path.join(__dirname, 'data.json');
        this.config = null;
        this.data = { accounts: {} };
        this.active = false;
        this.saveTimer = null;
        this.restore = [];
        this.now = () => Date.now();
    }

    defaultConfig() {
        return {
            enabled: true,
            rewards: [50, 50, 75, 75, 100, 100, 250],
            repeatLastReward: false,
            graceDays: 0,
            utcOffsetHours: 0,
            skipBanned: true,
            logClaims: true
        };
    }

    async init() {
        try {
            this.LoggerService = require('../../src/service/logger/logger-service');
            this.DatabaseManager = require('../../src/manager/database-manager');

            this.loadConfig();
            if (!this.config.enabled) {
                this.LoggerService.log('info', '[DailyBonus] Plugin disabled in config');
                return true;
            }

            this.loadData();
            this.hookLogin();
            this.registerCommand();
            this.registerRoute();
            this.active = true;

            this.LoggerService.log('success', `[DailyBonus] Ready, ${this.config.rewards.length}-day reward cycle`);
            return true;
        } catch (error) {
            if (this.LoggerService) this.LoggerService.log('error', `[DailyBonus] Failed to initialize: ${error.message}`);
            return false;
        }
    }

    loadConfig() {
        const defaults = this.defaultConfig();
        if (!fs.existsSync(this.configPath)) {
            this.config = defaults;
            fs.writeFileSync(this.configPath, JSON.stringify(defaults, null, 4), 'utf8');
            return;
        }
        this.config = { ...defaults, ...JSON.parse(fs.readFileSync(this.configPath, 'utf8')) };

        const valid = Array.isArray(this.config.rewards) && this.config.rewards.length > 0
            && this.config.rewards.every(n => Number.isInteger(n) && n > 0);
        if (!valid) {
            this.LoggerService.log('warn', '[DailyBonus] "rewards" must be a list of whole numbers above 0, using the defaults');
            this.config.rewards = defaults.rewards;
        }
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) this.data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            if (!this.data.accounts) this.data.accounts = {};
        } catch (error) {
            this.LoggerService.log('warn', `[DailyBonus] Could not read data.json (${error.message}), starting empty`);
            this.data = { accounts: {} };
        }
    }

    saveData() {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        const temp = `${this.dataPath}.tmp`;
        fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), 'utf8');
        fs.renameSync(temp, this.dataPath);
    }

    scheduleSave() {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            try {
                this.saveData();
            } catch (error) {
                this.LoggerService.log('error', `[DailyBonus] Could not save data.json: ${error.message}`);
            }
        }, 2000);
    }

    dayNumber(time = this.now()) {
        return Math.floor((time + this.config.utcOffsetHours * 3600000) / DAY_MS);
    }

    rewardFor(streak) {
        const rewards = this.config.rewards;
        if (streak <= rewards.length) return rewards[streak - 1];
        return this.config.repeatLastReward ? rewards[rewards.length - 1] : rewards[(streak - 1) % rewards.length];
    }

    status(accountId) {
        const entry = this.data.accounts[accountId] || { streak: 0, lastDay: null, total: 0 };
        const today = this.dayNumber();
        const claimedToday = entry.lastDay === today;
        const alive = entry.lastDay !== null && today - entry.lastDay <= 1 + this.config.graceDays;
        const nextStreak = claimedToday ? entry.streak + 1 : (alive ? entry.streak + 1 : 1);

        return {
            streak: entry.streak,
            totalClaimed: entry.total,
            claimedToday,
            nextReward: this.rewardFor(nextStreak),
            nextStreak
        };
    }

    async claim(accountId) {
        const today = this.dayNumber();
        const entry = this.data.accounts[accountId] || { streak: 0, lastDay: null, total: 0 };
        if (entry.lastDay === today) return null;

        if (this.config.skipBanned && await this.DatabaseManager.AccountIsBanned(accountId)) return null;

        const alive = entry.lastDay !== null && today - entry.lastDay <= 1 + this.config.graceDays;
        const streak = alive ? entry.streak + 1 : 1;
        const amount = this.rewardFor(streak);

        const result = await this.DatabaseManager.addVbucks(accountId, amount);
        if (!result || !result.success) return null;

        this.data.accounts[accountId] = { streak, lastDay: today, total: entry.total + amount };
        this.scheduleSave();

        if (this.config.logClaims) {
            this.LoggerService.log('info', `[DailyBonus] ${accountId} claimed ${amount} V-Bucks (day ${streak})`);
        }
        return { amount, streak };
    }

    hookLogin() {
        const original = this.DatabaseManager.updateLastLogin;
        const self = this;

        this.DatabaseManager.updateLastLogin = async function (accountId, ...rest) {
            const result = await original.call(this, accountId, ...rest);
            if (self.active && result !== false) {
                self.claim(accountId).catch(error => {
                    self.LoggerService.log('warn', `[DailyBonus] Claim failed: ${error.message}`);
                });
            }
            return result;
        };
        this.restore.push(() => { this.DatabaseManager.updateLastLogin = original; });
    }

    registerCommand() {
        const CommandManager = require('../../src/manager/command-manager');
        const usage = () => this.LoggerService.log('info', 'Usage: /dailybonus <status|reset|grant> <player>');

        CommandManager.register('/dailybonus', async (args) => {
            const [action, name] = args;
            if (!action || !name) return usage();

            const account = await this.DatabaseManager.getAccountByDisplayName(name);
            if (!account) return this.LoggerService.log('warn', `Player "${name}" not found`);

            if (action === 'status') {
                const s = this.status(account.accountId);
                this.LoggerService.log('info', `${account.displayName}: streak ${s.streak}, total ${s.totalClaimed} V-Bucks, ${s.claimedToday ? 'already claimed today' : `next reward ${s.nextReward}`}`);
            } else if (action === 'reset') {
                delete this.data.accounts[account.accountId];
                this.scheduleSave();
                this.LoggerService.log('success', `Daily bonus streak of ${account.displayName} reset`);
            } else if (action === 'grant') {
                const claimed = await this.claim(account.accountId);
                this.LoggerService.log(claimed ? 'success' : 'warn', claimed
                    ? `Granted ${claimed.amount} V-Bucks (day ${claimed.streak}) to ${account.displayName}`
                    : `${account.displayName} already claimed today, or cannot receive the bonus`);
            } else {
                usage();
            }
        });
        this.restore.push(() => CommandManager.commands.delete('/dailybonus'));
    }

    registerRoute() {
        const EndpointManager = require('../../src/manager/endpoint-manager');
        const WebService = require('../../src/service/api/web-service');
        const WebResponse = require('../../src/service/api/web-response-service');
        if (!EndpointManager.app) return;

        EndpointManager.app.get('/plugins/daily-bonus/me', WebService.verifyToken, (req, res) => {
            if (!this.active) return WebResponse.notFound(res, 'The daily bonus is not active.');
            return WebResponse.ok(res, this.status(req.user.accountId));
        });
    }

    async shutdown() {
        this.active = false;
        for (const undo of this.restore.splice(0)) undo();
        if (this.saveTimer) {
            try {
                this.saveData();
            } catch (error) {
                this.LoggerService.log('error', `[DailyBonus] Could not save data.json: ${error.message}`);
            }
        }
        this.LoggerService.log('info', '[DailyBonus] Plugin shut down');
    }
}

module.exports = DailyBonus;
