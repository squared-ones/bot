# Contributing to Squared One

Thanks for your interest in contributing! Squared One is a multitool Discord
bot with a web dashboard. This guide covers how to get set up and how to
contribute.

## Getting started

1. **Fork** the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in the values you need. For most
   frontend/web work you can leave `DISCORD_TOKEN` empty and run the web server
   only:

   ```bash
   DISCORD_TOKEN= PORT=3000 npm start
   ```

## Development workflow

- `npm start` — run the app.
- `npm run dev` — run with auto-reload (`node --watch`).
- `node --check <file>` — syntax-check a JavaScript file.

There is no build step, linter, or test suite — the frontend is plain
HTML/CSS/JS. Please run `node --check` on any JS you change and boot the server
to confirm nothing breaks before opening a PR.

## Style guide

- Match the existing code style (2-space indentation, single quotes, trailing
  commas in multi-line objects/arrays).
- Keep ES-module imports/exports (`import`/`export`), matching `"type": "module"`.
- Reuse existing CSS variables and utility classes instead of adding new
  styling. The theme is red-on-black with JetBrains Mono + Outfit fonts.
- Keep every ID/class that `app.js` references intact when editing dashboard
  markup.

## Reporting bugs

Use the **Bug report** issue template. Include:

- What you expected to happen vs. what happened
- Steps to reproduce
- Node.js version, Discord.js version, and OS
- Any relevant logs or error messages

## Suggesting features

Use the **Feature request** issue template. Describe the problem your feature
solves and how you'd expect it to behave. Keep scope realistic.

## Pull requests

1. Use the pull request template.
2. Keep PRs focused on a single change.
3. Update the README or docs if behavior changes.
4. Make sure the code passes `node --check` and the app still boots.

## Licensing

By contributing, you agree that your contributions will be licensed under the
project's license (Apache License 2.0). See [LICENSE](LICENSE).
