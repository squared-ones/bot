import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  getAllRules,
  getCustomRules,
  addCustomRule,
  removeCustomRule,
} from './rules.js';
import { buildEmbedFromSpec, validateEmbedSpec } from './embed.js';

export const botState = {
  client: null,
  username: null,
  startedAt: null,
  guildCount: 0,
  memberCount: 0,
};

const COLOR = 0x00ffcc;

function buildRulesEmbed(title, footer) {
  const all = getAllRules();
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(title)
    .setDescription(
      'Please read and follow these rules to keep the community safe and fun.'
    )
    .setFooter({ text: footer })
    .setTimestamp();

  if (all.length === 0) {
    embed.addFields({ name: 'No rules yet', value: 'No rules configured.' });
    return embed;
  }

  const lines = all.map(
    (r, i) =>
      `**${i + 1}. ${r.title}**${r.custom ? '  `custom`' : ''}\n${r.description}`
  );
  embed.addFields({ name: '\u200b', value: lines.join('\n\n') });
  return embed;
}

const commands = [
  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('View the server rules'),
  new SlashCommandBuilder()
    .setName('addrule')
    .setDescription('Add a custom rule (moderators only)')
    .addStringOption((o) =>
      o.setName('title').setDescription('Rule title').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('description')
        .setDescription('Rule description')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('removerule')
    .setDescription('Remove a custom rule (moderators only)')
    .addStringOption((o) =>
      o
        .setName('id')
        .setDescription('Which custom rule to remove')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  new SlashCommandBuilder()
    .setName('postrules')
    .setDescription('Post the rules to a channel (moderators only)')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to post in (defaults to the current channel)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement with markdown formatting (moderators only)')
    .addStringOption((o) =>
      o
        .setName('message')
        .setDescription('Announcement text (supports **bold**, *italic*, `code`, etc.)')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('title')
        .setDescription('Embed title (only used when embed is enabled)')
        .setRequired(false)
    )
    .addBooleanOption((o) =>
      o
        .setName('embed')
        .setDescription('Send the message inside an embed')
        .setRequired(false)
    )
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to post in (defaults to the current channel)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Build and post a rich embed (moderators only)')
    .addStringOption((o) =>
      o.setName('title').setDescription('Embed title (supports markdown)').setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName('description')
        .setDescription('Embed description (supports markdown)')
        .setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('color').setDescription('Hex color, e.g. #5865F2').setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('author').setDescription('Author name').setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('footer').setDescription('Footer text').setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('thumbnail').setDescription('Thumbnail image URL').setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('image').setDescription('Main image URL').setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName('fields')
        .setDescription(
          'JSON array of fields, e.g. [{"name":"Info","value":"hi","inline":true}]'
        )
        .setRequired(false)
    )
    .addBooleanOption((o) =>
      o.setName('timestamp').setDescription('Show a timestamp').setRequired(false)
    )
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to post in (defaults to the current channel)')
        .setRequired(false)
    ),
];

function isModerator(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true
  );
}

async function handleInteraction(interaction) {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = getCustomRules()
      .filter((r) => r.title.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((r) => ({ name: r.title, value: r.id }));
    await interaction.respond(matches);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const guildName = interaction.guild?.name ?? 'Rules';

  try {
    if (commandName === 'rules') {
      await interaction.reply({
        embeds: [buildRulesEmbed('📜 Server Rules', guildName)],
      });
      return;
    }

    if (commandName === 'addrule') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content: '⛔ You need the **Manage Server** permission to add rules.',
          ephemeral: true,
        });
        return;
      }
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const rule = addCustomRule(title, description);
      await interaction.reply({
        content: `✅ Added rule **${rule.title}** (\`${rule.id}\`).`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'removerule') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to remove rules.',
          ephemeral: true,
        });
        return;
      }
      const id = interaction.options.getString('id');
      const ok = removeCustomRule(id);
      await interaction.reply({
        content: ok
          ? '✅ Rule removed.'
          : '❌ That rule was not found (only custom rules can be removed).',
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'postrules') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to post rules.',
          ephemeral: true,
        });
        return;
      }
      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          ephemeral: true,
        });
        return;
      }
      await channel.send({
        embeds: [buildRulesEmbed('📜 Server Rules', guildName)],
      });
      await interaction.reply({
        content: `📢 Rules posted in ${channel}.`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'announce') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to make announcements.',
          ephemeral: true,
        });
        return;
      }
      const message = interaction.options.getString('message');
      const title = interaction.options.getString('title');
      const asEmbed = interaction.options.getBoolean('embed') ?? false;
      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          ephemeral: true,
        });
        return;
      }
      if (asEmbed) {
        const embed = new EmbedBuilder().setDescription(message);
        if (title) embed.setTitle(title);
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }
      await interaction.reply({
        content: `📢 Announcement posted in ${channel}.`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'embed') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content: '⛔ You need the **Manage Server** permission to post embeds.',
          ephemeral: true,
        });
        return;
      }

      const spec = {
        title: interaction.options.getString('title') ?? undefined,
        description: interaction.options.getString('description') ?? undefined,
        color: interaction.options.getString('color') ?? undefined,
        author: interaction.options.getString('author') ?? undefined,
        footer: interaction.options.getString('footer') ?? undefined,
        thumbnail: interaction.options.getString('thumbnail') ?? undefined,
        image: interaction.options.getString('image') ?? undefined,
        timestamp: interaction.options.getBoolean('timestamp') ?? false,
        fields: [],
      };

      const rawFields = interaction.options.getString('fields');
      if (rawFields) {
        let parsed;
        try {
          parsed = JSON.parse(rawFields);
        } catch {
          await interaction.reply({
            content:
              '❌ `fields` must be valid JSON, e.g. `[{"name":"Info","value":"hi","inline":true}]`.',
            ephemeral: true,
          });
          return;
        }
        if (!Array.isArray(parsed)) {
          await interaction.reply({
            content: '❌ `fields` must be a JSON array.',
            ephemeral: true,
          });
          return;
        }
        spec.fields = parsed;
      }

      const err = validateEmbedSpec(spec);
      if (err) {
        await interaction.reply({ content: `❌ ${err}`, ephemeral: true });
        return;
      }

      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          ephemeral: true,
        });
        return;
      }

      await channel.send({ embeds: [buildEmbedFromSpec(spec)] });
      await interaction.reply({
        content: `📢 Embed posted in ${channel}.`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error('[bot] interaction error:', err);
    const payload = { content: '❌ Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}

function updateStats(client) {
  botState.guildCount = client.guilds.cache.size;
  botState.memberCount = client.guilds.cache.reduce(
    (sum, g) => sum + g.memberCount,
    0
  );
}

// Lists guilds + text channels the bot can post in, for the web dashboard.
export function getGuildChannels() {
  const client = botState.client;
  if (!client || !client.isReady()) return [];
  return client.guilds.cache.map((guild) => {
    const me = guild.members.me;
    return {
      id: guild.id,
      name: guild.name,
      channels: guild.channels.cache
        .filter(
          (c) =>
            c.isTextBased() &&
            (!me || c.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages))
        )
        .map((c) => ({ id: c.id, name: c.name })),
    };
  });
}

export async function startBot(token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });
  botState.client = client;

  client.once('ready', async () => {
    botState.username = client.user.tag;
    botState.startedAt = new Date();
    updateStats(client);
    console.log(`[bot] ${client.user.tag} is online.`);

    try {
      await client.application.commands.set(
        commands.map((c) => c.toJSON())
      );
      console.log('[bot] slash commands registered globally.');
    } catch (err) {
      console.error('[bot] failed to register commands:', err.message);
    }

    if (process.env.CLIENT_ID) {
      const invite = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
      console.log(`[bot] invite: ${invite}`);
    }
  });

  client.on('guildMemberAdd', async (member) => {
    try {
      await member.send({
        embeds: [
          buildRulesEmbed(
            `📜 Welcome to ${member.guild.name}!`,
            'Please read our rules'
          ),
        ],
      });
    } catch {
      // Member has DMs disabled — ignore.
    }
  });

  client.on('guildCreate', () => updateStats(client));
  client.on('guildDelete', () => updateStats(client));
  client.on('interactionCreate', handleInteraction);

  await client.login(token);
  return client;
}
