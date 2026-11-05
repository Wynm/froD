# froD — Roadmap

A living plan. Done items are checked; the rest are candidate next steps.

## ✅ Shipped (v1.1)
- [x] Core simulation: conveyors, collisions, rides, dives, timer, pickups
- [x] Deterministic procedural levels with crossability guarantees
- [x] Classic + seeded Daily Challenge modes
- [x] 4 themes (day/dusk/night/dawn) with headlights & fireflies
- [x] Procedural pixel art + WebAudio chip music & SFX (zero asset files)
- [x] Arabic/English i18n with full RTL
- [x] Menu, pause, game over, how-to, scores, achievements (14), stats, settings
- [x] Touch (swipe + d-pad), keyboard, haptics
- [x] Autopilot attract-mode demo + solvability tests
- [x] PWA offline support + generated icons
- [x] 67 automated tests incl. boot-and-play integration
- [x] Headless software rasterizer for real screenshots

## 🔜 Next candidates
- [x] **More lane actors**: snakes that chase on logs + snatching herons (moving lily pads still planned)
- [x] **Lady-frog escort bonus**: carry a companion home for big points (classic!)
- [x] **Combo system**: chain homes without a death for up to ×5 points
- [ ] **Weekly challenge** alongside daily, with a longer horizon leaderboard
- [ ] **Replay / ghost**: record inputs and race your best daily run
- [x] **Gamepad support** (Gamepad API: d-pad/stick, A, Start)
- [x] **Wildlife update**: escort companions, log snakes, telegraphed heron, 2 achievements, migration-safe stats
- [ ] **Colorblind-friendly palette** option + high-contrast mode
- [ ] **More music tracks** unlocked by level, with a tiny composer
- [ ] **Level editor** with shareable seeds/codes
- [ ] **Online leaderboards** (optional backend, still no client deps)
- [ ] **Speedrun mode** with split timers
- [ ] **Accessibility**: full keyboard navigation of menus, screen-reader labels

## 🧪 Quality / infra
- [ ] Property-based tests for conveyor wrap over long runs
- [ ] Visual regression diffing of screenshots in CI
- [ ] Lighthouse / PWA audit pass
- [ ] Bundle size + performance budget checks
