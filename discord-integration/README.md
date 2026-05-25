# Discord Integration Plugin

A comprehensive Discord integration plugin for Neodyme that provides webhook notifications and a Discord bot for server management.
**MADE BY**: [Aorux01](https://github.com/Aorux01) - Neodyme Team

## Features

- **Server Status Webhooks**: Get notified when the server starts and stops
- **Shop Rotation Webhooks**: Posts the rendered shop image (SVG) to a Discord channel on every rotation, with an automatic text fallback if the image generator is unavailable
- **Discord Bot**: Full-featured bot with slash commands for server management
- **Role-based Permissions**: Configure which Discord roles can use which commands
- **Customizable Embeds**: Full control over embed colors and styling
- 
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

