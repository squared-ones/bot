import 'dotenv/config';
import { loadRules } from './rules.js';
import { startBot } from './bot.js';
import { startServer } from './server.js';

const PORT = Number(process.env.PORT) || 3000;

const ruleCount = loadRules().length;
console.log(`[rules] loaded ${ruleCount} rules.`);

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
