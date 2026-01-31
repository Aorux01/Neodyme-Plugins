# Discord Integration Plugin

A comprehensive Discord integration plugin for Neodyme that provides webhook notifications and a Discord bot for server management.
**MADE BY**: [Aorux01](https://github.com/Aorux01) **[OFFICIAL PLUGIN]**

**Version**: 1.0.0
**Minimum Backen Version**: 1.2.0

## Features

- **Server Status Webhooks**: Get notified when the server starts and stops
- **Shop Rotation Webhooks**: Automatic notifications when the item shop rotates
- **Discord Bot**: Full-featured bot with slash commands for server management
- **Role-based Permissions**: Configure which Discord roles can use which commands
- **Customizable Embeds**: Full control over embed colors and styling

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
        }
    },

    "bot": {
        "enabled": false,               // Enable Discord bot
        "token": "",                    // Bot token from Developer Portal
        "clientId": "",                 // Application Client ID
        "guildId": "",                  // Your Discord server ID
        "prefix": "!",                  // Command prefix (for future use)

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
| `/createaccount` | Create a new player account | Everyone |
| `/viewaccount` | View account information | Admin, Moderator, Support |
| `/banuser` | Ban a player | Admin, Moderator |
| `/unbanuser` | Unban a player | Admin, Moderator |
| `/givevbucks` | Give V-Bucks to a player | Admin |
| `/serverstatus` | View server status | Everyone |
| `/playercount` | View player count | Everyone |

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
