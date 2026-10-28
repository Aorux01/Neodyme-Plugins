# Daily Bonus Plugin

A Neodyme plugin that gives every player a V-Bucks bonus the first time they sign in each day, with a streak that raises the reward.
**MADE BY**: [Aorux01](https://github.com/Aorux01) - Neodyme Team

## Features

- **Daily V-Bucks bonus**: granted on the first sign-in of the day, from the game or from the website
- **Streak rewards**: each consecutive day moves one step up a configurable reward list; a missed day restarts the streak
- **Grace days and time zone**: let players miss days without losing the streak, and choose when the day changes
- **Safe by default**: banned accounts receive nothing, and a player can never claim twice in one day
- **Console command**: check, reset or grant a bonus by hand with `/dailybonus`
- **Route for the website**: `GET /plugins/daily-bonus/me` returns the streak and the next reward of the signed-in player

---

## Quick Setup

1. Install the plugin from the store, or place the `daily-bonus` folder in `plugins/`
2. Edit `config.json` if you want other rewards
3. Restart the server

The version folders (`1.0.0`, ...) each contain their own README with the full configuration reference.

---

## Troubleshooting

### Players do not receive the bonus?

1. Check that `enabled` is `true` in `config.json`
2. The bonus is given once per day: use `/dailybonus status <player>` to see whether it was already claimed
3. Banned accounts are skipped while `skipBanned` is `true`
4. Look for `[DailyBonus]` lines in the console and in the launch log file

### The streak restarts too often?

1. Raise `graceDays` to allow missed days
2. Set `utcOffsetHours` so that the day changes at the hour your players expect

---

## Support

For issues or feature requests, please open an issue in this repository.
