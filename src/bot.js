import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import {
  getAllRules,
  getCustomRules,
  addCustomRule,
  removeCustomRule,
} from './rules.js';
import { parseDuration, formatDuration, purgeMessages } from './moderation.js';
import {
  getVerificationConfig,
  detectFlags,
  isJoinBurst,
} from './verification.js';
import {
  getDueVoteReminders,
  markVoteReminded,
} from './voting.js';

export const botState = {
  client: null,
  username: null,
  startedAt: null,
  guildCount: 0,
  memberCount: 0,
};

// Checks whether a dashboard user owns the Discord application. This is used
// for global controls that should not be delegated to individual servers.
export async function isApplicationOwner(userId) {
  const application = botState.client?.application;
  if (!application || !userId) return false;
  try {
    const owner = application.owner || (await application.fetch()).owner;
    if (owner?.ownerId) return owner.ownerId === userId;
    return owner?.id === userId;
  } catch {
    return false;
  }
}

const APP_URL = 'https://squared-one.onrender.com';
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
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Vote for Squared One on bot lists'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all Squared One commands'),
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify yourself to get the verified role'),
  new SlashCommandBuilder()
    .setName('verification-panel')
    .setDescription('Post a verification panel (moderators only)')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel for the panel (defaults to the current channel)')
        .setRequired(false)
    ),
];

function isModerator(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true
  );
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


async function sendVerificationLink(interaction) {
  const guild = interaction.guild;
  const config = getVerificationConfig(guild?.id);
  if (!guild || !config.roleId) {
    await interaction.reply({
      content:
        '❌ Verification is not configured for this server. Ask a server manager to configure it in the dashboard.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.member?.roles?.cache?.has(config.roleId)) {
    await interaction.reply({
      content: '✅ You are already verified.',
      ephemeral: true,
    });
    return;
  }

  const url = `${APP_URL}/verify?guild=${guild.id}`;
  try {
    await interaction.user.send(
      `🔒 **Verify for ${guild.name}**\nOpen this link to complete verification:\n${url}`
    );
    await interaction.reply({
      content: '📬 Check your DMs — I sent you a verification link.',
      ephemeral: true,
    });
  } catch {
    await interaction.reply({
      content: `🔒 Open this link to verify:\n${url}`,
      ephemeral: true,
    });
  }
}

async function handleInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId === 'verification:open') {
      await sendVerificationLink(interaction);
    }
    return;
  }

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
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🧭 Squared One Help')
        .setDescription('Here are the commands available in this server.')
        .addFields(
          {
            name: '📜 Rules',
            value:
              '`/rules` View the server rules\n`/addrule` Add a custom rule\n`/removerule` Remove a custom rule\n`/postrules` Post the rules to a channel',
          },
          {
            name: '📣 Messaging',
            value:
              '`/announce` Post an announcement',
          },
          {
            name: '🛡️ Moderation',
            value:
              '`/ban` Ban a member\n`/kick` Kick a member\n`/timeout` Timeout a member\n`/purge` Delete recent messages',
          },
          {
            name: '🔧 Utility',
            value:
              '`/userinfo` Show user information\n`/serverinfo` Show server information\n`/avatar` Show an avatar\n`/ping` Check bot latency',
          },
          {
            name: '🌐 Community',
            value:
              '`/vote` Vote for Squared One\n`/verify` Complete server verification\n`/verification-panel` Post a verification panel\n`/help` Show this help message',
          }
        )
        .setFooter({ text: 'Squared One · Use /help any time' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

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
      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          ephemeral: true,
        });
        return;
      }
      await channel.send(message);
      await interaction.reply({
        content: `📢 Announcement posted in ${channel}.`,
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

    if (commandName === 'vote') {
      const botId = interaction.client.user.id;
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🗳️ Vote for Squared One')
        .setDescription(
          'Voting helps Squared One grow and reach more servers. It only takes a second — thank you for your support!'
        )
        .addFields(
          {
            name: 'top.gg',
            value: `[Vote on top.gg](https://top.gg/bot/${botId}/vote)`,
            inline: true,
          },
          {
            name: 'Discord Bot List',
            value: `[Vote on discordbotlist.com](https://discordbotlist.com/bots/${botId}/upvote)`,
            inline: true,
          }
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Vote on top.gg')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://top.gg/bot/${botId}/vote`),
        new ButtonBuilder()
          .setLabel('Vote on Discord Bot List')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discordbotlist.com/bots/${botId}/upvote`)
      );
      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (commandName === 'verification-panel') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to post a verification panel.',
          ephemeral: true,
        });
        return;
      }

      const config = getVerificationConfig(interaction.guild?.id);
      if (!config.roleId) {
        await interaction.reply({
          content:
            '❌ Configure a verified role in the dashboard before posting a verification panel.',
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

      const panel = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🔒 Server Verification')
        .setDescription(
          'Click the button below to receive a private verification link. Complete the CAPTCHA to get access to the server.'
        )
        .setFooter({ text: 'Squared One Verification' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verification:open')
          .setLabel('Verify now')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [panel], components: [row] });
      await interaction.reply({
        content: `✅ Verification panel posted in ${channel}.`,
        ephemeral: true,
      });
      return;
    }

    if (commandName === 'verify') {
      await sendVerificationLink(interaction);
      return;
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

// Assigns a role to a member (used by the web verification flow).
export async function assignRole(guildId, userId, roleId) {
  const client = botState.client;
  if (!client || !client.isReady()) throw new Error('bot is not connected');
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('guild not found');
  const member = await guild.members.fetch(userId);
  await member.roles.add(roleId);
}

// Returns true/false whether the member has the role, or null when unknown
// (bot offline or the user is not in the guild).
export async function isMemberVerified(guildId, userId, roleId) {
  const client = botState.client;
  if (!client || !client.isReady()) return null;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return member.roles.cache.has(roleId);
}

async function handleFlaggedMember(member, flags, config) {
  const tag = member.user.tag;
  const guildName = member.guild.name;
  const reason = flags.join('; ');
  console.log(`[verify] flag ${tag} in ${guildName}: ${reason}`);

  if (config.action === 'kick') {
    try {
      await member.kick(`Verification flag — ${reason}`);
      console.log(`[verify] kicked ${tag} from ${guildName}`);
    } catch (e) {
      console.error(`[verify] failed to kick ${tag}:`, e.message);
    }
  } else if (config.action === 'ban') {
    try {
      await member.ban({ reason: `Verification flag — ${reason}` });
      console.log(`[verify] banned ${tag} from ${guildName}`);
    } catch (e) {
      console.error(`[verify] failed to ban ${tag}:`, e.message);
    }
  }

  if (config.logChannelId) {
    try {
      const ch = await member.guild.channels.fetch(config.logChannelId);
      if (ch?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('🚨 Verification flag')
          .setDescription(
            `**${tag}** (\`${member.user.id}\`)\n${flags
              .map((f) => `• ${f}`)
              .join('\n')}`
          )
          .setTimestamp();
        await ch.send({ embeds: [embed] });
      }
    } catch {
      // Ignore log failures.
    }
  }
}

async function sendDueVoteReminders(client) {
  const due = getDueVoteReminders();
  for (const vote of due) {
    try {
      const user = await client.users.fetch(vote.userId);
      const botId = client.user.id;
      await user.send(
        `🗳️ You can vote for Squared One again!\n\n` +
          `Top.gg: https://top.gg/bot/${botId}/vote\n` +
          `Discord Bot List: https://discordbotlist.com/bots/${botId}/upvote`
      );
    } catch {
      // Ignore users with DMs disabled or accounts that no longer exist.
    } finally {
      markVoteReminded(vote.id);
    }
  }
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

  client.once('clientReady', async () => {
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
    const config = getVerificationConfig(member.guild.id);
    const flags = detectFlags(member, config);
    if (isJoinBurst(member.guild.id, config)) {
      flags.push(
        `join burst (${config.joinBurst}+ joins in ${config.joinBurstWindow}s)`
      );
    }
    if (flags.length) {
      await handleFlaggedMember(member, flags, config);
    }

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
  const reminderTimer = setInterval(() => {
    sendDueVoteReminders(client).catch((error) => {
      console.error('[vote] reminder error:', error.message);
    });
  }, 10 * 60 * 1000);
  reminderTimer.unref?.();
  return client;
}
