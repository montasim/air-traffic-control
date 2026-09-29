# Contributing

Use Node.js 24 and npm 11. Run `npm ci`, then `npm run dev`.

Before opening a pull request, run `npm test` and `npm run build` (which also
checks TypeScript). Explain the player-facing change and how you verified it.
For UI changes, include desktop and narrow-screen screenshots. For gameplay
changes, add a regression test for the affected simulation or progression rule.

Keep the cream, teal, and amber visual language consistent with [DESIGN.md](DESIGN.md).
Preserve existing IndexedDB saves and separate records by map, difficulty, and
orientation. Do not rename legacy storage keys merely to match the product name.

Report reproducible bugs through GitHub issues, including browser, viewport,
airfield, difficulty, steps, and expected versus actual behavior. Do not include
private data or credentials. Do not post exploitable security details publicly.

Changes should remain focused; avoid committing generated `dist/`, local
Netlify linkage, secrets, or dependency directories.
