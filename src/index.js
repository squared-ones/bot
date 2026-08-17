import 'dotenv/config';
import { loadRules } from './rules.js';
import { loadCredits } from './credits.js';
import { loadTranslations } from './translations.js';
import { loadAccounts } from './accounts.js';
import { startBot } from './bot.js';
import { startServer } from './server.js';
import { loadDataFromGitHub } from './github-data.js';
import {
  loadSharding,
  getShardCount,
  getServerShardIds,
} from './sharding.js';

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  await loadDataFromGitHub();

  const ruleCount = loadRules().length;
  console.log(`[rules] loaded ${ruleCount} rules.`);
  loadCredits();
  const localeCount = Object.keys(loadTranslations().catalog).length;
  console.log(`[i18n] loaded ${localeCount} translatable strings.`);
  const accountCount = Object.keys(loadAccounts()).length;
  console.log(`[accounts] loaded ${accountCount} account${accountCount === 1 ? '' : 's'}.`);
  loadSharding();

  startServer(PORT);

  const token = process.env.DISCORD_TOKEN;
  if (token) {
    const shardCount = getShardCount();
    const serverShards = getServerShardIds();
    if (shardCount > 1) {
      console.log(
        `[bot] sharded mode: ${shardCount} shards; server runs ${serverShards.join(', ')}.`
      );
    }
    // The server runs its own shard(s); workers claim the remaining shards
    // and connect as the same application.
    for (const shardId of serverShards) {
      startBot(token, { shardId, shardCount }).catch((err) => {
        console.error(`[bot] shard ${shardId} failed to start:`, err.message);
      });
    }
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
