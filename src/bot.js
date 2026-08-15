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

const COLOR = 0xff0000;

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
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member (Ban Members permission)')
    .addUserOption((o) =>
      o.setName('user').setDescription('Member to ban').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('reason').setDescription('Reason for the ban').setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member (Kick Members permission)')
    .addUserOption((o) =>
      o.setName('user').setDescription('Member to kick').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('reason').setDescription('Reason for the kick').setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (Moderate Members permission)')
    .addUserOption((o) =>
      o.setName('user').setDescription('Member to timeout').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('duration')
        .setDescription('Duration, e.g. 30s, 10m, 1h, 2d')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages (Manage Messages permission)')
    .addIntegerOption((o) =>
      o
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((o) =>
      o
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show info about a user')
    .addUserOption((o) =>
      o
        .setName('user')
        .setDescription('User to look up (defaults to you)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show info about this server'),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show a user's avatar")
    .addUserOption((o) =>
      o
        .setName('user')
        .setDescription('User (defaults to you)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
];

function isModerator(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true
  );
}

// Parses a duration like "30s", "10m", "1h", "2d" (bare numbers = minutes).
function parseDuration(input) {
  if (input == null) return null;
  const m = String(input).trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d)?$/);
  if (!m) return null;
  let ms = parseInt(m[1], 10);
  const unit = m[2] || 'm';
  if (unit === 's') ms *= 1000;
  else if (unit === 'm') ms *= 60 * 1000;
  else if (unit === 'h') ms *= 60 * 60 * 1000;
  else if (unit === 'd') ms *= 24 * 60 * 60 * 1000;
  return ms;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Returns an error string when the invoker or bot lacks a permission.
function checkPermission(interaction, permission, label) {
  if (!interaction.memberPermissions?.has(permission)) {
    return `⛔ You need the **${label}** permission to do that.`;
  }
  const me = interaction.guild?.members?.me;
  if (me && !me.permissions.has(permission)) {
    return `❌ I don't have the **${label}** permission in this server.`;
  }
  return null;
}

// Returns an error string when a moderation action would violate role hierarchy.
function canModerate(interaction, member) {
  if (!member) return '❌ That member is not in this server.';
  if (member.id === interaction.user.id) {
    return "❌ You can't do that to yourself.";
  }
  if (member.id === interaction.guild.ownerId) {
    return "❌ You can't do that to the server owner.";
  }
  const invoker = interaction.member;
  if (invoker && invoker.id !== interaction.guild.ownerId) {
    if (member.roles.highest.position >= invoker.roles.highest.position) {
      return "❌ You can't do that to someone with an equal or higher role.";
    }
  }
  const me = interaction.guild?.members?.me;
  if (me && member.roles.highest.position >= me.roles.highest.position) {
    return "❌ I can't do that to someone with a higher role than mine.";
  }
  return null;
}

async function purgeMessages(channel, amount, user) {
  if (!channel?.isTextBased()) return 0;
  const fetched = await channel.messages.fetch({ limit: amount });
  const targets = user
    ? fetched.filter((m) => m.author.id === user.id)
    : fetched;
  if (targets.size === 0) return 0;
  if (targets.size === 1) {
    await targets.first().delete();
    return 1;
  }
  const deleted = await channel.bulkDelete(targets, true);
  return deleted.size;
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
      return;
    }

    // ---------- Moderation ----------
    if (commandName === 'ban') {
      const permErr = checkPermission(
        interaction,
        PermissionFlagsBits.BanMembers,
        'Ban Members'
      );
      if (permErr) {
        await interaction.reply({ content: permErr, ephemeral: true });
        return;
      }
      const user = interaction.options.getUser('user');
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);
      if (member) {
        const modErr = canModerate(interaction, member);
        if (modErr) {
          await interaction.reply({ content: modErr, ephemeral: true });
          return;
        }
      }
      await interaction.guild.bans.create(user.id, {
        reason: `Banned by ${interaction.user.tag} — ${reason}`,
      });
      await interaction.reply({
        content: `✅ Banned **${user.tag}** (${reason}).`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'kick') {
      const permErr = checkPermission(
        interaction,
        PermissionFlagsBits.KickMembers,
        'Kick Members'
      );
      if (permErr) {
        await interaction.reply({ content: permErr, ephemeral: true });
        return;
      }
      const member = interaction.options.getMember('user');
      const modErr = canModerate(interaction, member);
      if (modErr) {
        await interaction.reply({ content: modErr, ephemeral: true });
        return;
      }
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      await member.kick(`Kicked by ${interaction.user.tag} — ${reason}`);
      await interaction.reply({
        content: `✅ Kicked **${member.user.tag}** (${reason}).`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'timeout') {
      const permErr = checkPermission(
        interaction,
        PermissionFlagsBits.ModerateMembers,
        'Moderate Members'
      );
      if (permErr) {
        await interaction.reply({ content: permErr, ephemeral: true });
        return;
      }
      const member = interaction.options.getMember('user');
      const modErr = canModerate(interaction, member);
      if (modErr) {
        await interaction.reply({ content: modErr, ephemeral: true });
        return;
      }
      const ms = parseDuration(interaction.options.getString('duration'));
      if (ms == null || ms <= 0) {
        await interaction.reply({
          content:
            '❌ Invalid duration — use e.g. `30s`, `10m`, `1h`, or `2d`.',
          ephemeral: true,
        });
        return;
      }
      if (ms > 28 * 24 * 60 * 60 * 1000) {
        await interaction.reply({
          content: '❌ Timeouts can be at most 28 days.',
          ephemeral: true,
        });
        return;
      }
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      await member.timeout(
        ms,
        `Timed out by ${interaction.user.tag} — ${reason}`
      );
      await interaction.reply({
        content: `✅ Timed out **${member.user.tag}** for ${formatDuration(
          ms
        )} (${reason}).`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'purge') {
      const permErr = checkPermission(
        interaction,
        PermissionFlagsBits.ManageMessages,
        'Manage Messages'
      );
      if (permErr) {
        await interaction.reply({ content: permErr, ephemeral: true });
        return;
      }
      const amount = interaction.options.getInteger('amount');
      const user = interaction.options.getUser('user') ?? null;
      await interaction.deferReply({ ephemeral: true });
      const deleted = await purgeMessages(interaction.channel, amount, user);
      await interaction.editReply({
        content: `🧹 Deleted ${deleted} message${deleted === 1 ? '' : 's'}.`,
      });
      return;
    }

    // ---------- Utility ----------
    if (commandName === 'userinfo') {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          {
            name: 'Account created',
            value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
            inline: true,
          }
        );
      if (member) {
        embed.addFields(
          {
            name: 'Joined',
            value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: 'Roles',
            value: String(
              member.roles.cache.filter((r) => r.id !== interaction.guild.id)
                .size
            ),
            inline: true,
          },
          {
            name: 'Nickname',
            value: member.nickname ?? 'None',
            inline: true,
          }
        );
      }
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (commandName === 'serverinfo') {
      const g = interaction.guild;
      const owner = await g.fetchOwner().catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: g.name, iconURL: g.iconURL() })
        .setThumbnail(g.iconURL({ size: 256 }))
        .addFields(
          { name: 'ID', value: g.id, inline: true },
          {
            name: 'Owner',
            value: owner ? owner.user.tag : 'Unknown',
            inline: true,
          },
          { name: 'Members', value: String(g.memberCount), inline: true },
          { name: 'Channels', value: String(g.channels.cache.size), inline: true },
          { name: 'Roles', value: String(g.roles.cache.size), inline: true },
          { name: 'Boost level', value: String(g.premiumTier), inline: true },
          {
            name: 'Created',
            value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`,
            inline: true,
          }
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (commandName === 'avatar') {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`${user.username}'s avatar`)
        .setImage(user.displayAvatarURL({ size: 1024 }));
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (commandName === 'ping') {
      const sent = await interaction.reply({
        content: '🏓 Pinging…',
        fetchReply: true,
      });
      const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply({
        content: `🏓 Pong! WebSocket: **${interaction.client.ws.ping}ms** · Round-trip: **${roundtrip}ms**`,
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
