# Daily Bonus Plugin

Gives every player a V-Bucks bonus the first time they sign in each day, with a streak that raises the reward.
**MADE BY**: [Aorux01](https://github.com/Aorux01) - Neodyme Team

**Version**: 1.0.0
**Minimum Backend Version**: 1.2.9

## How it works

- The bonus is granted on the first sign-in of the day, from the game or from the website.
- Signing in again the same day grants nothing more.
- Each consecutive day moves one step up the `rewards` list. Missing a day (more than `graceDays`) restarts at day 1.
- After the last step, the cycle starts again, or stays on the last reward if `repeatLastReward` is true.
- Banned accounts do not receive the bonus.
- Streaks are kept in `data.json` next to the plugin, written safely and saved when the server stops.

## Configuration

`config.json`:

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Turn the plugin on or off |
| `rewards` | `[50, 50, 75, 75, 100, 100, 250]` | V-Bucks for day 1, day 2, ... Whole numbers above 0 |
| `repeatLastReward` | `false` | `true`: keep the last reward after the list ends. `false`: start the list again |
| `graceDays` | `0` | Extra days a player may miss without losing the streak |
| `utcOffsetHours` | `0` | Shifts the moment the day changes, for example `2` for UTC+2 |
| `skipBanned` | `true` | Banned accounts get nothing |
| `logClaims` | `true` | Write each claim in the console |

## Console command

| Command | Description |
|---|---|
| `/dailybonus status <player>` | Streak, total received and next reward |
| `/dailybonus reset <player>` | Restart the streak of a player |
| `/dailybonus grant <player>` | Give today's bonus now (once per day) |

## Route for the website or a plugin

`GET /plugins/daily-bonus/me` (signed in) returns:

```json
{ "success": true, "streak": 3, "totalClaimed": 175, "claimedToday": true, "nextReward": 75, "nextStreak": 4 }
```

## Changelog

### 1.0.0
- Initial release.
