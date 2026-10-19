# KEYCLASH — Product and release plan

**Promise:** Type to command the map. Make a plan. Beat your friend in 60 seconds.

**Product:** A free, browser-based typing tactics game. A room link starts a private 1v1 without accounts. Solo bot and a shared daily map provide instant practice. Public beta: https://keyclash-arena.clownprinc.chatgpt.site/ · Source: https://github.com/CIownPrinc/Keyclash

This document records the product decisions and the remaining work to make the game easy to share and worth replaying. Scope stays small: make the map, typing, and opponent create the depth. Do not add progression systems or screens until players show they need them.

## Product research

Research combines direct browser inspection with products suited to the individual design problem. These are references for useful patterns, not templates to copy.

| Reference | Useful pattern | KEYCLASH decision |
| --- | --- | --- |
| [Nitro Type](https://www.nitrotype.com/race) | The race track makes the activity legible immediately; guest play reduces the distance to a first round. | Keep the typing action and game state visible together. Let a new player start without an account. |
| [Monkeytype](https://monkeytype.com/) | Quiet typography, immediate keyboard feedback, simple settings, clear results. | Protect the typing line and make word feedback instant. Keep optional setup outside the match. |
| [Lichess friend challenge](https://lichess.org/page/blind-mode-guide) | A link is enough to bring a friend into a challenge. | Make friend play the first menu choice. Support a copied invite link and a short room code. |
| [Into the Breach](https://www.subsetgames.com/itb.html) | Small boards stay tactical when threats and consequences are readable. | Show reach, strength, territory value, contract targets, and event timing before a choice. |
| [The Battle of Polytopia](https://polytopia.io/polytopia-switch/) | Terrain and connected control make map position itself strategically useful. | Let supply, chokepoints, terrain, and routes carry strategy instead of adding a large ability menu. |
| [Teamfight Tactics: Cyber City](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/mechanics-cyber-city/) and [Dragonlands learnings](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-teamfight-tactics-dragonlands-learnings/) | Shared variation can make rounds feel different; excessive or one-sided variance removes agency. | Vary the shared map and objective, cap bonuses, and let players choose how to respond. |

## Audience and first session

**Primary:** friends, classmates, and coworkers who can type and want a quick competitive match. **Secondary:** solo players learning the map and returning for the daily seed.

A first-time player should be able to create a room or start a bot round in under 20 seconds, understand the contract and reachable words during the countdown, and find replay or rematch at the result screen. The game is designed for a physical keyboard; say so before play on touch devices.

## The 60-second loop

1. Choose friend, bot, or daily mode. Never launch a match unexpectedly.
2. Read the shared round contract and notice the marked target or route.
3. Type a reachable word to capture, attack, reinforce, or spend an airdrop.
4. Balance quick low-value expansion against slower valuable ground and contested enemy land.
5. Keep a chain alive for stronger hits and a small capture spread, while watching the rival and the bounty.
6. Stay linked to the capital so territory scores. Review the score breakdown and rematch.

The central decision is which word and tile to target. Avoid interrupting a 60-second round with card picks, modal choices, or recurring tutorials.

## Strategy and fair variation

The current rules already give the game useful decisions: terrain has different point and word costs; mountains take more hits; frontline tiles can be reinforced or stolen; disconnected land scores nothing; chains reward pace and accuracy; airdrops trade supply for reach; temporary bounties reward map awareness.

Add only one lightweight round modifier: a seeded contract, selected once and shared by both players. It is visible in the HUD and reflected as a separate result stat.

- **Relic Run:** each supplied shrine held at the buzzer adds 2 points, up to 4. Mark both shrines.
- **Supply Web:** every five supplied hexes beyond the capital adds 1 point, up to 4.
- **Breakthrough:** each supplied enemy hex still held at the buzzer adds 2 points, up to 6.

Contracts reuse the board and supply rules, so they change routes without creating a separate minigame. Keep bonuses bounded, maps point-symmetric, and random events equally available. Give a short warning before a bounty appears. Never add hidden personal buffs or random damage. Reassess bonuses with real paired matches; a bot result cannot establish competitive balance.

### Scope guardrail

Ship these three contracts and polish the current modes. Do not add accounts, ranked matchmaking, chat, monetization, permanent abilities, multiple currencies, new turn phases, or a large event deck in this release. Add a system only when playtest evidence shows a specific problem the simpler game cannot solve.

## Experience and visual direction

### Entry and friend play

The first screen offers three clearly named actions: **Play a friend**, **Quick battle vs Nova**, and **Daily island**. Friend play is prominent and states that no account is needed. The room form explains link and code entry; the waiting screen makes copying and leaving clear. Refresh restores the seat, and expired rooms offer a direct way back. Bot pace stays a small optional control.

### Match

Keep the hierarchy stable: player scores and timer, one compact contract strip, readable map, then chain / typing line / air drops. Use color plus outlines, shape, labels, and strength dots. A player can type without clicking; clicking only locks a target. Show bounty timing shortly before activation. Hints are brief and shown once; help stays available. Capture effects should confirm a move without hiding words. Honor reduced-motion preferences.

### Results

Show final points and a distinct contract-points stat beside WPM, accuracy, best chain, and hexes. Offer bot replay, friend rematch, and the daily result share where appropriate. Keep the result card quick to read and easy to screenshot.

### Brand

Keep the original island-command palette: deep sea, parchment, blue and coral teams, gold objectives, and tactile hexes. Replace the generic letter-in-hex mark with the crossed-keycaps emblem. Use the same plain vocabulary throughout: hex, supply, chain, bounty, contract, airdrop. Improve spacing and hierarchy before adding decoration.

## Engineering and operations

Keep the game rules shared between local mode, browser, and hosted Worker. The Worker remains authoritative for room tokens, reach, exact words, match time, strike rate, and concurrent actions; keep the seed private. Rooms support two seats, refresh recovery, rematches, presence, and idle expiry. No account or behavioral analytics is needed for this beta. Keep display names short and sanitized. Retain the zero-dependency local Node server.

Before release, build the hosted source and manually confirm page/assets, friend create/join in separate browser sessions, waiting and match start, one legal action, result, rematch, refresh recovery, and share preview. Keep the public page, social card, launch copy, GitHub source, and this plan aligned.

## Beta learning goals

Ask paired players what they tried to do, whether the contract changed their route, what felt unclear, and whether they wanted another round. Watch the friend flow and note room errors. For a useful sample, compare outcomes by contract, map, seat, typing speed, and accuracy. Treat these targets as signals, not claims:

- Friend invite to joined room takes under 20 seconds when both players are available.
- At least 70% of started friend rounds reach results without a room error.
- With enough evenly matched games, no contract repeatedly wins above 55%.
- Players can explain supply and their contract after one round.
- At least half of paired testers want a rematch.

## Action plan and status

### A. Product research and direction — complete

- [x] Inspect typing products in browser and record applicable lessons.
- [x] Research friend challenges, readable tactics, territory maps, and bounded variance.
- [x] Set a small release scope and observable beta questions.

### B. Friend-first entry and brand — in progress

- [x] Put friend, bot, and daily choices on the first screen; remove the implicit bot start.
- [x] Explain account-free invites and physical-keyboard expectations.
- [x] Improve the original KEYCLASH wordmark and favicon.
- [ ] Confirm room create, join, wait, refresh, and rematch with two independent browser sessions on the published build.

### C. Match strategy — implementation complete; verify live

- [x] Add three shared seeded contracts with symmetric scoring and capped bonuses.
- [x] Show the contract in the match HUD, mark relic targets, and expose contract points in results.
- [x] Warn shortly before a bounty appears; keep current random events bounded.
- [x] Explain the contract in the first-match hint and help.

### D. Finish and release — in progress

- [ ] Check narrow and desktop layouts, menu clarity, logo, and contract legibility in browser.
- [ ] Build and deploy the hosted source; confirm live multiplayer and social preview.
- [ ] Commit and push the finished product and plan.
- [ ] Invite paired testers and use their feedback to choose the next change, if any.

## Release decision

The beta is ready to share when the friend-first menu, all three contracts, live multiplayer in two browser sessions, result breakdown, public page, and share image work together. Call it a public beta, not a balanced competitive ladder. Keep the next release small and let player evidence choose its scope.