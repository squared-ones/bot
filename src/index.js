import 'dotenv/config';
import { loadRules } from './rules.js';
import { loadCredits } from './credits.js';
import { loadAccounts } from './accounts.js';
import { startBot } from './bot.js';
import { startServer } from './server.js';
import { loadDataFromGitHub } from './github-data.js';

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  await loadDataFromGitHub();

  const ruleCount = loadRules().length;
  console.log(`[rules] loaded ${ruleCount} rules.`);
  loadCredits();
  const accountCount = Object.keys(loadAccounts()).length;
  console.log(`[accounts] loaded ${accountCount} account${accountCount === 1 ? '' : 's'}.`);

  startServer(PORT);

  const token = process.env.DISCORD_TOKEN;
  if (token) {
    startBot(token).catch((err) => {
      console.error('[bot] failed to start:', err.message);
    });
  } else {
    console.warn(
      '[bot] DISCORD_TOKEN not set — bot disabled, running web dashboard only.'
    );
  }
}

main().catch((err) => {
  console.error('[app] failed to start:', err.message);
  process.exitCode = 1;
});
