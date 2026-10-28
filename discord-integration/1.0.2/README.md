# Discord Integration Plugin

A comprehensive Discord integration plugin for Neodyme that provides webhook notifications and a Discord bot for server management.
**MADE BY**: [Aorux01](https://github.com/Aorux01) - Neodyme Team

**Version**: 1.0.2
**Minimum Backend Version**: 1.2.9

## Features

- **Server Status Webhooks**: Get notified when the server starts and stops
- **Shop Rotation Webhooks**: Posts the rendered shop image (SVG) to a Discord channel on every rotation, with an automatic text fallback if the image generator is unavailable
- **Discord Bot**: Full-featured bot with slash commands for server management
- **Role-based Permissions**: Configure which Discord roles can use which commands
- **Customizable Embeds**: Full control over embed colors and styling
- **Staff Alerts**: Optional webhook for new tickets, ban appeals and sensitive staff actions
- **Linked Accounts**: Players find their account with `/whoami` thanks to the Discord link made on the website
- **Audit Trail**: Every ban, unban, V-Bucks gift and account creation made from Discord appears in the Neodyme audit log

## Changelog

### 1.0.2
- Bot actions are written to the Neodyme audit log (`ban`, `unban`, `discord.give_vbucks`, `discord.create_account`), with the Discord user as performer.
- `/banuser` also ends the player's sessions.
- `/createaccount` applies the same email, username and password rules as the website, and refuses a username that is already taken. Its default is now limited to admin and moderator roles.
- `/givevbucks` only accepts a whole amount between 1 and `bot.maxVbucksPerCommand` (100000 by default).
- New `/whoami` (everyone) and `/lookupmember` (staff roles): find the Neodyme account linked to a Discord user. Players link Discord from the Security page of the website.
- `/serverstatus` reports the real health checks (Operational, Degraded or Outage) instead of always saying Online.
- New optional `staffAlerts` webhook: new support tickets, new ban appeals, and staff actions such as two-factor resets, forced password resets and ended sessions.
- A `config.json` from an older version keeps working: missing keys take their default value.
- The shop and alert hooks are removed when the plugin stops or reloads, so reloading no longer stacks them.
- A command that fails after answering no longer tries to answer a second time.
- Requires Neodyme **1.2.9+**.

### 1.0.1
- Shop rotation webhook now attaches the generated shop image (SVG) instead of a truncated text list. Falls back to the legacy text summary if the image generator fails.
- Requires Neodyme **1.2.5+** for the shop image generator.

### 1.0.0
- Initial release.

---

## Quick Setup

### 1. Webhook Setup (No bot required)

1. In Discord, go to your server's **Server Settings** > **Integrations** > **Webhooks**
2. Click **New Webhook**
3. Name it (e.g., "Neodyme Server Status")
4. Select the channel where you want notifications
5. Click **Copy Webhook URL**
6. Paste the URL in `config.json`:

```json
"webhooks": {
    "serverStatus": {
        "enabled": true,
        "url": "YOUR_WEBHOOK_URL_HERE",
        "username": "Neodyme Server",
        "avatarUrl": ""
    }
}
```

### 2. Bot Setup (For commands)

#### Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it (e.g., "Neodyme Bot")
4. Go to the **Bot** section
5. Click **Add Bot**
6. Under **Token**, click **Reset Token** and copy it
7. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent

#### Step 2: Get Client ID

1. Go to **OAuth2** > **General**
2. Copy the **Client ID**

#### Step 3: Invite the Bot

1. Go to **OAuth2** > **URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

#### Step 4: Get Guild ID

1. In Discord, enable **Developer Mode** (Settings > Advanced > Developer Mode)
2. Right-click your server name and click **Copy Server ID**

#### Step 5: Configure the Plugin

Edit `config.json`:

```json
"bot": {
    "enabled": true,
    "token": "YOUR_BOT_TOKEN",
    "clientId": "YOUR_CLIENT_ID",
    "guildId": "YOUR_GUILD_ID",
    "prefix": "!",
    "roles": {
        "admin": ["ROLE_ID_1", "ROLE_ID_2"],
        "moderator": ["ROLE_ID_3"],
        "support": ["ROLE_ID_4"]
    }
}
```

#### Step 6: Install discord.js

Run in the Neodyme root directory:

```bash
npm install discord.js
```

#### Step 7: Restart the Server

Restart Neodyme to load the plugin with the bot.

---

## Configuration Reference

### config.json

```json
{
    "enabled": true,                    // Enable/disable the entire plugin

    "webhooks": {
        "serverStatus": {
            "enabled": true,            // Enable server status webhooks
            "url": "",                  // Discord webhook URL
            "username": "Neodyme",      // Webhook display name
            "avatarUrl": ""             // Webhook avatar (optional)
        },
        "shopRotation": {
            "enabled": true,
            "url": "",
            "username": "Neodyme Shop",
            "avatarUrl": ""
        },
        "staffAlerts": {
            "enabled": false,           // Staff channel alerts, needs a webhook URL
            "url": "",
            "username": "Neodyme Staff",
            "avatarUrl": "",
            "events": { "tickets": true, "appeals": true, "security": true }
        }
    },

    "bot": {
        "enabled": false,               // Enable Discord bot
        "token": "",                    // Bot token from Developer Portal
        "clientId": "",                 // Application Client ID
        "guildId": "",                  // Your Discord server ID
        "prefix": "!",                  // Command prefix (for future use)
        "maxVbucksPerCommand": 100000,  // Upper limit for /givevbucks

        "roles": {
            "admin": [],                // Array of Discord role IDs
            "moderator": [],
            "support": []
        },

        "commands": {
            "createAccount": {
                "enabled": true,
                "allowedRoles": ["admin", "moderator"]
            },
            // ... other commands
        }
    },

    "embeds": {
        "colors": {
            "success": "#00ff00",
            "error": "#ff0000",
            "info": "#0099ff",
            "warning": "#ffcc00",
            "serverOnline": "#00ff00",
            "serverOffline": "#ff0000",
            "shopRotation": "#9b59b6"
        },
        "footer": {
            "text": "Neodyme Server",
            "iconUrl": ""
        },
        "showTimestamp": true
    }
}
```

---

## Bot Commands

| Command | Description | Default Roles |
|---------|-------------|---------------|
| `/createaccount` | Create a new player account | Admin, Moderator |
| `/viewaccount` | View account information | Admin, Moderator, Support |
| `/banuser` | Ban a player | Admin, Moderator |
| `/unbanuser` | Unban a player | Admin, Moderator |
| `/givevbucks` | Give V-Bucks to a player | Admin |
| `/serverstatus` | View server status | Everyone |
| `/playercount` | View player count | Everyone |
| `/whoami` | Show the Neodyme account linked to your Discord | Everyone |
| `/lookupmember` | Show the account linked to a Discord member | Admin, Moderator, Support |

### Command Options

#### /createaccount
- `email` (required): Player's email address
- `username` (required): Player's display name
- `password` (required): Account password

#### /viewaccount
- `username` (required): Username to look up

#### /banuser
- `username` (required): Username to ban
- `reason` (optional): Ban reason
- `duration` (optional): Ban duration (e.g., `7d`, `30d`, `permanent`)

#### /unbanuser
- `username` (required): Username to unban

#### /givevbucks
- `username` (required): Username to give V-Bucks to
- `amount` (required): Amount of V-Bucks

#### /lookupmember
- `member` (required): The Discord member to look up

Discord roles decide who may use the bot commands, because the commands run on Discord. Actions that change an account are also recorded in the Neodyme audit log.

---

## Getting Role IDs

1. Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)
2. Go to Server Settings > Roles
3. Right-click on a role and click **Copy Role ID**
4. Add the ID to the appropriate role array in `config.json`

---

## Troubleshooting

### Bot not responding to commands?

1. Make sure the bot has been invited with the `applications.commands` scope
2. Verify the `guildId` is correct
3. Check that `discord.js` is installed: `npm install discord.js`
4. Check the console for error messages

### Webhooks not sending?

1. Verify the webhook URL is correct
2. Make sure the webhook hasn't been deleted in Discord
3. Check that `enabled` is set to `true`

### Commands showing "Permission Denied"?

1. Verify your Discord role ID is in the correct role array
2. Make sure the command's `allowedRoles` includes your role type
3. An empty `allowedRoles` array means everyone can use the command

---

## Support

For issues or feature requests, please open an issue in this repository.
