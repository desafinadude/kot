# Phone fixes — round 2

- [x] 1. Dice gravity X reversed (tilt left → dice roll right): fix sign in `physics.js setGravity`
- [x] 2. Player cards vertical on phone: **name above image, HP/VP/energy below** (no side-by-side) — `ui.js renderPlayers` + `paper.css`
- [x] 3. Menu option to disable gravity dice: setup toggle **GRAVITY / IN PLACE**, persisted; in-place = dice appear & change in place (DOM dice, no physics flight)
- [x] 4. Verify: smoke + mobile viewport (stacked cards, toggle → in-place roll), bump `?v`
