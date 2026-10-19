# KEYCLASH — Product and release plan

**Promise:** Type to command the map. Make a plan. Beat your friend in 60 seconds.

**Product:** A free, browser-based typing tactics game. A room link starts a private 1v1 without accounts. Solo bot and a shared daily map provide instant practice. Public beta: https://keyclash-arena.clownprinc.chatgpt.site/ · Source: https://github.com/CIownPrinc/Keyclash

This document records the product decisions and the remaining work to make the game easy to share and worth replaying. Scope stays small: maps, typing, commander styles, and the opponent create the depth. Keep setup on the home page, avoid mandatory popups, and do not add progression systems until players show they need them.

## Product research

Research combines direct browser inspection with products suited to the individual design problem. These are references for useful patterns, not templates to copy.

| Reference | Useful pattern | KEYCLASH decision |
| --- | --- | --- |
| [Nitro Type](https://www.nitrotype.com/race) | The race track makes the activity legible immediately; guest play reduces the distance to a first round. | Keep the typing action and game state visible together. Let a new player start without an account. |
| [Monkeytype](https://monkeytype.com/) | Quiet typography, immediate keyboard feedback, simple settings, clear results. | Protect the typing line and make word feedback instant. Keep optional setup outside the match. |
| [Lichess friend challenge](https://lichess.org/page/blind-mode-guide) | A link is enough to bring a friend into a challenge. | Make friend play the first menu choice. Support a copied invite link and a short room code. |
| [Into the Breach](https://www.subsetgames.com/itb.html) | Small boards stay tactical when threats and consequences are readable. | Show reach, strength, territory value, contract targets, and event timing before a choice. |
| [The Battle of Polytopia](https://polytopia.io/polytopia-switch/) | Terrain and connected control make map position itself strategically useful. | Let supply, chokepoints, terrain, and routes carry strategy. Offer a few readable commander passives instead of an ability menu. |
| [Teamfight Tactics: Cyber City](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/mechanics-cyber-city/) and [Dragonlands learnings](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-teamfight-tactics-dragonlands-learnings/) | Shared variation can make rounds feel different; excessive or one-sided variance removes agency. | Vary the shared map and objective, cap bonuses, and let players choose how to respond. |

## Audience and first session

**Primary:** friends, classmates, and coworkers who can type and want a quick competitive match. **Secondary:** solo players learning the map and returning for the daily seed.

A first-time player should be able to choose a commander and map, then create a room or start a bot round in under 20 seconds. Friend rooms use the host's map and both players' commander choices. Rematches rotate to the next balanced map. The game is designed for a physical keyboard; say so before play on touch devices.

## The 60-second loop

1. Choose a commander, map, and friend, bot, or daily mode. Never launch a match unexpectedly.
2. Read the shared round contract and notice the marked target or route.
3. Type a reachable word to capture, attack, reinforce, or spend an airdrop.
4. Balance quick low-value expansion against slower valuable ground and contested enemy land.
5. Keep a chain alive for stronger hits and a small capture spread, while watching the rival and the bounty.
6. Stay linked to the capital so territory scores. Review the score breakdown and rematch.

The central decision is which word and tile to target. Commander and map choices happen before the match; no pick interrupts the 60-second round.

## Strategy and fair variation

The current rules already give the game useful decisions: terrain has different point and word costs; mountains take more hits; frontline tiles can be reinforced or stolen; disconnected land scores nothing; chains reward pace and accuracy; airdrops trade supply for reach; temporary bounties reward map awareness.

Add only one lightweight round modifier: a seeded contract, selected once and shared by both players. It is visible in the HUD and reflected as a separate result stat.

- **Relic Run:** each supplied shrine held at the buzzer adds 2 points, up to 4. Mark both shrines.
- **Supply Web:** every five supplied hexes beyond the capital adds 1 point, up to 4.
- **Breakthrough:** each supplied enemy hex still held at the buzzer adds 2 points, up to 6.

Contracts reuse the board and supply rules, so they change routes without creating a separate minigame. Keep bonuses bounded, maps point-symmetric, and random events equally available. Give a short warning before a bounty appears. Commander passives are visible before the match and the server applies the same rules to both seats:

- **Vanguard:** deals 1 extra damage when attacking enemy-held hexes; earns an airdrop every 6 strikes instead of 5.
- **Quartermaster:** earns an airdrop every 4 strikes instead of 5; has no direct combat bonus.
- **Warden:** frontline reinforcements add 2 strength, up to 4; earns an airdrop every 6 strikes.

Never add hidden personal buffs or random damage. Compare commander win rates and play patterns in paired tests; the bot is useful for tuning feel but cannot establish competitive balance.

### Scope guardrail

Keep the three contracts, three maps, and three commander passives. Do not add accounts, ranked matchmaking, chat, monetization, activated abilities, cooldowns, upgrade trees, multiple currencies, new turn phases, or a large event deck. Add a system only when playtest evidence shows a specific problem the simpler game cannot solve.

## Experience and visual direction

### Entry and friend play

The home page is the first screen, not a dimmed dialog over a battle. It introduces the game, lets players compare three compact commander cards, previews the selected map, and offers **Play a friend**, **Quick battle vs Nova**, and **Daily island**. Friend play is prominent and states that no account is needed. The room form explains link and code entry; the waiting screen shows the selected map and commander. Refresh restores the seat, and expired rooms offer a direct way back. Bot pace stays a small optional control.

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
- Review commander win rates and player feedback; no style should dominate across maps and typing ranges.
- Players can explain supply and their contract after one round.
- At least half of paired testers want a rematch.

## Action plan and status

### A. Product research and direction — complete

- [x] Inspect typing products in browser and record applicable lessons.
- [x] Research friend challenges, readable tactics, territory maps, and bounded variance.
- [x] Set a small release scope and observable beta questions.

### B. Friend-first entry and brand — complete

- [x] Put friend, bot, and daily choices on the first screen; remove the implicit bot start.
- [x] Explain account-free invites and physical-keyboard expectations.
- [x] Improve the original KEYCLASH wordmark and favicon.
- [x] Replace the menu popup with a real home page and make the key-fight mark read K versus C.
- [x] Confirm room creation, link join, waiting state, match start, and synced captures in two independent browser sessions on the published build.
- [x] Retain refresh recovery and rematch support from the existing production room flow (unchanged in this release).

### C. Match strategy — implemented, pending publish

- [x] Add three shared seeded contracts with symmetric scoring and capped bonuses.
- [x] Show the contract in the match HUD, mark relic targets, and expose contract points in results.
- [x] Warn shortly before a bounty appears; keep current random events bounded.
- [x] Explain the contract in the first-match hint and help.
- [x] Add a preview and player choice for the three balanced maps; rotate maps on rematch.
- [x] Add three visible commander passives with distinct offensive, expansion, and defensive tradeoffs.
- [x] Apply commander choices in solo matches and authoritative multiplayer rooms; cover core rules with tests.

### D. Finish and release — complete

- [x] Review the desktop menu, friend entry, logo, and live contract in browser.
- [x] Review the smallest supported touch layout before a broad mobile promotion.
- [ ] Build and deploy the updated hosted source; confirm live multiplayer and social metadata/image.
- [ ] Commit and push the updated product and plan.


### E. After the first share - player learning

This is follow-up work after the owner shares the public beta; it does not block the product from being tried.

- [ ] Invite paired testers and ask whether the contract changed their route, what was unclear, and whether they want a rematch.
- [ ] Review any repeated friction before adding features.

## Release decision

The beta is ready to share when the home page, map and commander choices, all three contracts, live multiplayer in two browser sessions, result breakdown, public page, and share image work together. Call it a public beta, not a balanced competitive ladder. Keep the next release small and let player evidence choose its scope.
