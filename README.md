# Keyclash

A typing war game. Each hex on the island map has a word on it. Type a word next to your land to march on it, break the enemy's lines, and hold the most valuable ground when the 60-second clock runs out.

Play a quick battle against the bot Nova (chill, steady, or fierce), the daily battle (the same seeded map for everyone, with a streak and a shareable result), or a live 1v1 room with a friend.

## Run

Requires Node.js 20 or newer. No dependencies.

```sh
npm start
```

Open `http://localhost:3000` on a computer; the game is built for a physical keyboard. The WPM shown after a battle is "battle WPM": it includes the time spent picking targets, so it runs lower than a plain typing test.

For a two-player match choose **Play a friend**, create a room, and send the invite link to someone who can reach the same server. Set `PORT` to change the port. `COUNTDOWN_MS` overrides the 3-second pre-battle countdown (the tests set it to `0`).

```sh
npm test
```

## Rules

- Start typing any word with a white outline. Matching hexes light up as you type, and the word fires the moment it is complete. Clicking a hex locks onto it; Esc clears.
- Hexes have strength (the dots). Each word knocks off 1. When it hits 0 the hex is yours, and every hit swaps in a new word.
- Typing a word on your own border hex adds 1 strength (max 3).
- **Chain:** type a word within 3 seconds of the last one. At 3 your words hit for 2 (Rally). At 6, captures also take up to 2 open neighbouring hexes (Blitz).
- **Supply:** land that isn't connected to your castle scores nothing. Castles can't be taken.
- Plains 1 point, forest 2, mountain 3 (starts at strength 2), shrine 4. A bounty hex appears every 12 seconds; capturing it adds 2 points that stay with the hex.
- Every 5 words earns an airdrop (max 2): take open land two hexes away in one word, behind enemy lines.
- Most points at the end wins. Hex count breaks a tie.

## Code map

| File | Role |
| --- | --- |
| `game.js` | Rules, maps, seeded randomness. Shared by server and client. |
| `bot.js` | Nova's move choice and typing pace. |
| `map.js` | SVG battlefield rendering and effects. |
| `progress.js` | XP, ranks, daily seed and streak, share text. |
| `sound.js` | Synthesised sound effects. |
| `app.js` | Typing, match flow, online play, menus. |
| `server.mjs` | Static files and the authoritative room API. |

The server is authoritative: it checks every word, keeps the random seed to itself, refuses strikes faster than 250 WPM, and rate-limits room creation per address. Room state lives in the server process. Restarting the server ends active matches, and rooms close after 30 idle minutes. Refreshing the page mid-match rejoins the same seat. Progress (XP, streak, bests) is stored in the browser.
