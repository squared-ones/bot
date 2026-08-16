import {
  Client,
  ChannelType,
  GatewayIntentBits,
  MessageFlags,
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
import {
  getAutoroleConfig,
  addAutoroleRole,
  removeAutoroleRole,
} from './autoroles.js';
import {
  isRestoreEnabled,
  setRestoreEnabled,
  saveMemberRoles,
  takeMemberRoles,
} from './restore.js';
import {
  getTicketConfig,
  setTicketConfig,
  savePanel,
  trackTicket,
  untrackTicket,
  getOpenTickets,
} from './tickets.js';
import {
  createAppeal,
  listAppeals,
  getAppeal,
  reviewAppeal,
} from './appeals.js';
import {
  getLevelConfig,
  setLevelConfig,
  getUserXp,
  addXp,
  addMessageXp,
  getLeaderboard,
  getRank,
  xpProgress,
  resetUserXp,
  resetGuildXp,
} from './levels.js';
import {
  PLANS,
  formatCredits,
  getBalance,
  grantCredits,
  getGuildPlan,
  getGuildSubscription,
  getUserPlan,
  subscribeGuild,
  planRequiredError,
  FREE_CUSTOM_RULE_LIMIT,
} from './credits.js';
import {
  getSticky,
  setSticky,
  removeSticky,
  listStickies,
  updateStickyMessageId,
} from './stickies.js';

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

// Sends the bot's slash-command list to discordbotlist.com so it shows on the
// bot page (https://docs.discordbotlist.com/commands-list). No-op unless
// DBL_API_TOKEN is configured.
function getValidatedDiscordBotId(rawBotId) {
  if (typeof rawBotId !== 'string') return null;
  const botId = rawBotId.trim();
  // Discord snowflake IDs are numeric; constrain length to expected bounds.
  if (!/^\d{17,20}$/.test(botId)) return null;
  return botId;
}

async function syncDiscordBotListCommands(client) {
  const token = process.env.DBL_API_TOKEN;
  const rawBotId = client.application?.id || process.env.CLIENT_ID;
  const botId = getValidatedDiscordBotId(rawBotId);
  if (!token || !botId) return;
  try {
    const res = await fetch(
      `https://discordbotlist.com/api/v1/bots/${botId}/commands`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands.map((c) => c.toJSON())),
      }
    );
    if (!res.ok) throw new Error(`discordbotlist.com returned ${res.status}`);
    console.log('[dbl] command list synced to discordbotlist.com.');
  } catch (err) {
    console.error('[dbl] failed to sync command list:', err.message);
  }
}

// Posts guild/user/voice-connection counts to discordbotlist.com
// (https://docs.discordbotlist.com/bot-statistics). No-op unless DBL_API_TOKEN
// is configured.
async function syncDiscordBotListStats(client) {
  const token = process.env.DBL_API_TOKEN;
  const rawBotId = client.application?.id || process.env.CLIENT_ID;
  const botId = getValidatedDiscordBotId(rawBotId);
  if (!token || !botId) return;
  try {
    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce(
      (sum, guild) => sum + (guild.memberCount || 0),
      0
    );
    const voiceConnections = client.guilds.cache.reduce(
      (sum, guild) => sum + guild.voiceStates.cache.size,
      0
    );
    const res = await fetch(
      `https://discordbotlist.com/api/v1/bots/${botId}/stats`,
      {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guilds,
          users,
          voice_connections: voiceConnections,
        }),
      }
    );
    if (!res.ok) throw new Error(`discordbotlist.com returned ${res.status}`);
    console.log(
      `[dbl] stats posted: ${guilds} guilds, ${users} users, ${voiceConnections} voice.`
    );
  } catch (err) {
    console.error('[dbl] failed to post stats:', err.message);
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
  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage roles assigned to new members (moderators only)')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add an autorole')
        .addRoleOption((o) =>
          o.setName('role').setDescription('Role to assign on join').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove an autorole')
        .addRoleOption((o) =>
          o.setName('role').setDescription('Role to remove').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List autoroles')
    ),
  new SlashCommandBuilder()
    .setName('restoreroles')
    .setDescription("Restore a member's roles when they rejoin (moderators only)")
    .addSubcommand((s) =>
      s.setName('enable').setDescription('Enable role restore on rejoin')
    )
    .addSubcommand((s) =>
      s.setName('disable').setDescription('Disable role restore on rejoin')
    )
    .addSubcommand((s) =>
      s.setName('status').setDescription('Show whether role restore is enabled')
    ),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open a support ticket')
    .addStringOption((o) =>
      o
        .setName('topic')
        .setDescription('What do you need help with?')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Configure the ticket system (moderators only)')
    .addChannelOption((o) =>
      o
        .setName('category')
        .setDescription('Category for ticket channels')
        .setRequired(true)
    )
    .addRoleOption((o) =>
      o
        .setName('staffrole')
        .setDescription('Staff role that can see tickets')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post an "Open ticket" button panel (moderators only)')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel for the panel (defaults to the current channel)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Appeal a ban')
    .addStringOption((o) =>
      o
        .setName('reason')
        .setDescription('Why should you be unbanned?')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('server')
        .setDescription('Which server banned you (required when DMing the bot)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('appeals')
    .setDescription('Review ban appeals (moderators only)')
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription('List appeals')
        .addStringOption((o) =>
          o
            .setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Approved', value: 'approved' },
              { name: 'Denied', value: 'denied' }
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName('review')
        .setDescription('Approve or deny an appeal')
        .addStringOption((o) =>
          o.setName('id').setDescription('Appeal ID').setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('decision')
            .setDescription('Decision')
            .setRequired(true)
            .addChoices(
              { name: 'Approve (unban)', value: 'approve' },
              { name: 'Deny', value: 'deny' }
            )
        )
        .addStringOption((o) =>
          o
            .setName('note')
            .setDescription('Note for the decision')
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your level and XP')
    .addUserOption((o) =>
      o
        .setName('user')
        .setDescription('User to look up (defaults to you)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard'),
  new SlashCommandBuilder()
    .setName('leveling')
    .setDescription('Configure the leveling system (moderators only)')
    .addSubcommand((s) =>
      s
        .setName('channel')
        .setDescription('Set the level-up announcement channel')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Channel for level-up messages')
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('announce')
        .setDescription('Toggle level-up announcements')
        .addStringOption((o) =>
          o
            .setName('value')
            .setDescription('on or off')
            .setRequired(true)
            .addChoices(
              { name: 'On', value: 'on' },
              { name: 'Off', value: 'off' }
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName('voicexp')
        .setDescription('Set XP awarded per minute in voice')
        .addIntegerOption((o) =>
          o
            .setName('amount')
            .setDescription('XP per minute (0-100)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('reset')
        .setDescription("Reset a member's XP")
        .addUserOption((o) =>
          o.setName('user').setDescription('Member to reset').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('resetall').setDescription("Reset everyone's XP in this server")
    ),
  new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Manage your Squared One credits')
    .addSubcommand((s) =>
      s
        .setName('balance')
        .setDescription('Check a credit balance')
        .addUserOption((o) =>
          o
            .setName('user')
            .setDescription('User to check (moderators only)')
            .setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('grant')
        .setDescription('Grant credits to a user (application owner only)')
        .addUserOption((o) =>
          o.setName('user').setDescription('User to grant').setRequired(true)
        )
        .addIntegerOption((o) =>
          o
            .setName('amount')
            .setDescription('Amount to grant')
            .setRequired(true)
            .setMinValue(1)
        )
    ),
  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe this server to a plan using your credits')
    .addStringOption((o) =>
      o
        .setName('plan')
        .setDescription('Plan to subscribe to')
        .setRequired(true)
        .addChoices({ name: 'Pro — 500 SQ/month', value: 'pro' })
    )
    .addIntegerOption((o) =>
      o
        .setName('months')
        .setDescription('Number of months (default 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(12)
    ),
  new SlashCommandBuilder()
    .setName('plan')
    .setDescription("Show this server's current plan"),
  new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages in this server')
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set a sticky message for a channel')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Channel for the sticky')
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('message')
            .setDescription('Sticky message text')
            .setRequired(true)
        )
        .addIntegerOption((o) =>
          o
            .setName('interval')
            .setDescription('Repost every N messages (default 1)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a channel sticky message')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Channel (defaults to this one)')
            .setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List sticky messages in this server')
    ),
];

function isModerator(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true
  );
}

// Returns a Pro-upgrade error message when the server is on the Free plan.
function requirePaid(interaction, featureLabel) {
  if (!interaction.guild || getGuildPlan(interaction.guild.id) !== 'free') {
    return null;
  }
  return `💳 ${planRequiredError(featureLabel)}`;
}

const stickyState = new Map(); // `${guildId}:${channelId}` -> { count, reposting }

async function handleStickyRepost(message) {
  const sticky = getSticky(message.guild.id, message.channel.id);
  if (!sticky?.content) return;
  const key = `${message.guild.id}:${message.channel.id}`;
  const state = stickyState.get(key) || { count: 0, reposting: false };
  state.count += 1;
  const interval = Math.max(1, sticky.interval || 1);
  if (state.count < interval || state.reposting) {
    stickyState.set(key, state);
    return;
  }
  state.count = 0;
  state.reposting = true;
  stickyState.set(key, state);
  try {
    if (sticky.messageId) {
      try {
        const old = await message.channel.messages.fetch(sticky.messageId);
        if (old) await old.delete();
      } catch {
        // The previous sticky was already deleted.
      }
    }
    const posted = await message.channel.send(sticky.content);
    updateStickyMessageId(message.guild.id, message.channel.id, posted.id);
  } finally {
    const current = stickyState.get(key);
    if (current) current.reposting = false;
  }
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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.member?.roles?.cache?.has(config.roleId)) {
    await interaction.reply({
      content: '✅ You are already verified.',
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
  } catch {
    await interaction.reply({
      content: `🔒 Open this link to verify:\n${url}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function openTicket(interaction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: '❌ Tickets can only be opened inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const config = getTicketConfig(guild.id);
  if (!config.categoryId || !config.staffRoleId) {
    await interaction.reply({
      content:
        '❌ The ticket system is not configured. A moderator must run `/ticketsetup`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const category = guild.channels.cache.get(config.categoryId);
  if (category?.type !== ChannelType.GuildCategory) {
    await interaction.reply({
      content: '❌ The configured ticket category no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const topic = interaction.options?.getString?.('topic') || null;
  const slug =
    (interaction.user.username || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24) || 'user';

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${slug}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: config.staffRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });
  } catch (err) {
    console.error('[ticket] failed to create channel:', err.message);
    await interaction.reply({
      content: '❌ I could not create the ticket channel. Check my permissions.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  trackTicket(guild.id, channel.id, interaction.user.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Close ticket')
      .setStyle(ButtonStyle.Danger)
  );
  await channel.send({
    content: `🎫 <@${interaction.user.id}> opened a ticket${
      topic ? ` — **${topic}**` : ''
    }. <@&${config.staffRoleId}> will help you shortly.`,
    components: [row],
  });
  await interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleTicketClose(interaction) {
  const channel = interaction.channel;
  const guild = interaction.guild;
  if (!channel || !guild) return;
  const config = getTicketConfig(guild.id);
  const ticket = getOpenTickets(guild.id)[channel.id];
  const isOwner = ticket?.ownerId === interaction.user.id;
  const isStaff =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ===
      true ||
    (config.staffRoleId &&
      interaction.member?.roles?.cache?.has(config.staffRoleId));
  if (!isOwner && !isStaff) {
    await interaction.reply({
      content: '❌ Only the ticket owner or staff can close this ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    content: '✅ Closing ticket…',
    flags: MessageFlags.Ephemeral,
  });
  untrackTicket(guild.id, channel.id);
  await channel.delete().catch(() => {});
}

async function applyAutomationOnJoin(member) {
  const guild = member.guild;
  const roleIds = new Set(getAutoroleConfig(guild.id).roleIds);
  if (isRestoreEnabled(guild.id)) {
    for (const roleId of takeMemberRoles(guild.id, member.id)) {
      roleIds.add(roleId);
    }
  }
  if (!roleIds.size) return;

  const me = guild.members.me;
  const assignable = [...roleIds].filter((roleId) => {
    const role = guild.roles.cache.get(roleId);
    if (!role || role.id === guild.id || role.managed) return false;
    if (me && role.position >= me.roles.highest.position) return false;
    return true;
  });
  if (!assignable.length) return;
  try {
    await member.roles.add(assignable, 'Automatic roles on join');
  } catch (err) {
    console.error(
      `[automation] failed to assign roles to ${member.user.tag}:`,
      err.message
    );
  }
}

function saveRolesOnLeave(member) {
  if (!isRestoreEnabled(member.guild.id)) return;
  const roleIds = member.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed)
    .map((role) => role.id);
  if (roleIds.length) saveMemberRoles(member.guild.id, member.id, roleIds);
}

async function resolveAppealGuild(interaction) {
  if (interaction.guild) return interaction.guild;
  const serverArg = interaction.options?.getString?.('server');
  if (!serverArg) return null;
  const query = serverArg.trim().toLowerCase();
  return (
    interaction.client.guilds.cache.find(
      (guild) =>
        guild.id === serverArg.trim() || guild.name.toLowerCase() === query
    ) || null
  );
}

async function announceLevelUp(guild, member, result) {
  const config = getLevelConfig(guild.id);
  if (!config.announce || !config.levelUpChannelId) return;
  const channel = guild.channels.cache.get(config.levelUpChannelId);
  if (!channel?.isTextBased()) return;
  try {
    await channel.send(`🎉 <@${member.id}> reached **level ${result.level}**!`);
  } catch (err) {
    console.error('[leveling] failed to announce level-up:', err.message);
  }
}

// Awards voice XP to every non-bot member currently connected to a voice
// channel. Runs on a one-minute interval.
async function awardVoiceXp(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = getLevelConfig(guild.id);
    if (config.voiceXpPerMinute <= 0) continue;
    for (const state of guild.voiceStates.cache.values()) {
      const member = state.member;
      if (!member || member.user.bot || !state.channelId) continue;
      const result = addXp(guild.id, member.id, config.voiceXpPerMinute);
      if (result.leveledUp) {
        await announceLevelUp(guild, member, result);
      }
    }
  }
}

async function handleInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId === 'verification:open') {
      await sendVerificationLink(interaction);
    } else if (interaction.customId === 'ticket:open') {
      await openTicket(interaction);
    } else if (interaction.customId === 'ticket:close') {
      await handleTicketClose(interaction);
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
              '`/announce` Post an announcement\n`/sticky` Manage sticky messages',
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
              '`/vote` Vote for Squared One\n`/verify` Complete server verification\n`/verification-panel` Post a verification panel\n`/appeal` Appeal a ban',
          },
          {
            name: '⚙️ Systems',
            value:
              '`/autorole` Manage join roles\n`/restoreroles` Restore roles on rejoin\n`/ticket` Open a support ticket\n`/ticketpanel` Post a ticket panel\n`/ticketsetup` Configure tickets\n`/appeals` Review appeals',
          },
          {
            name: '🎮 Leveling',
            value:
              '`/rank` Show your level\n`/leaderboard` Top members\n`/leveling` Configure leveling',
          },
          {
            name: '💳 Billing',
            value:
              '`/credits` Check or grant credits\n`/subscribe` Subscribe this server\n`/plan` Show this server plan',
          },
        )
        .setFooter({ text: 'Squared One · Use /help any time' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (commandName === 'credits') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'grant') {
        if (!(await isApplicationOwner(interaction.user.id))) {
          await interaction.reply({
            content: '⛔ Only the application owner can grant credits.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const balance = grantCredits(user.id, amount);
        await interaction.reply({
          content: `✅ Granted ${formatCredits(amount)} to ${user.tag}. Their balance is now ${formatCredits(balance)}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const target = interaction.options.getUser('user');
      if (target && target.id !== interaction.user.id && !isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to check other users.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const who = target ?? interaction.user;
      const balance = getBalance(who.id);
      await interaction.reply({
        content:
          who.id === interaction.user.id
            ? `💰 You have **${formatCredits(balance)}**.`
            : `💰 ${who.tag} has **${formatCredits(balance)}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'plan') {
      if (!interaction.guild) {
        await interaction.reply({
          content: '❌ Run this command in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const plan = getGuildPlan(interaction.guild.id);
      const sub = getGuildSubscription(interaction.guild.id);
      const expiry = sub && sub.expiresAt
        ? ` Expires <t:${Math.floor(sub.expiresAt / 1000)}:R>.`
        : sub
          ? ' This plan does not expire.'
          : ` Upgrade with /subscribe (${formatCredits(PLANS.pro.monthlyCost)}/month).`;
      await interaction.reply({
        content: `📊 This server is on the **${PLANS[plan].name}** plan.${expiry}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'subscribe') {
      if (!interaction.guild) {
        await interaction.reply({
          content: '❌ Run this command in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to subscribe this server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const planKey = interaction.options.getString('plan');
      const months = interaction.options.getInteger('months') || 1;
      const result = subscribeGuild({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        plan: planKey,
        months,
      });
      if (!result.ok) {
        await interaction.reply({
          content: `❌ ${result.error}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        content: `✅ Subscribed **${interaction.guild.name}** to ${PLANS[result.plan].name} for ${months} month${months === 1 ? '' : 's'} (${formatCredits(result.cost)}). Expires <t:${Math.floor(result.expiresAt / 1000)}:R>. Remaining balance: ${formatCredits(result.balance)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'sticky') {
      if (!interaction.guild) {
        await interaction.reply({
          content: '❌ Run this command in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to manage sticky messages.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        if (!channel?.isTextBased()) {
          await interaction.reply({
            content: '❌ Please provide a text channel.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const content = interaction.options.getString('message').slice(0, 2000);
        const interval = interaction.options.getInteger('interval') || 1;
        const existing = getSticky(guildId, channel.id);
        if (existing?.messageId) {
          try {
            const old = await channel.messages.fetch(existing.messageId);
            await old.delete();
          } catch {
            // The previous sticky was already deleted.
          }
        }
        const posted = await channel.send(content);
        setSticky(guildId, channel.id, {
          content,
          messageId: posted.id,
          interval,
        });
        stickyState.delete(`${guildId}:${channel.id}`);
        await interaction.reply({
          content: `✅ Sticky message set in ${channel} (reposts every ${interval} message${interval === 1 ? '' : 's'}).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'remove') {
        const channel =
          interaction.options.getChannel('channel') ?? interaction.channel;
        const existing = getSticky(guildId, channel.id);
        if (!existing) {
          await interaction.reply({
            content: '❌ There is no sticky message in that channel.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (existing.messageId) {
          try {
            const old = await channel.messages.fetch(existing.messageId);
            await old.delete();
          } catch {
            // The sticky was already deleted.
          }
        }
        removeSticky(guildId, channel.id);
        stickyState.delete(`${guildId}:${channel.id}`);
        await interaction.reply({
          content: `✅ Sticky message removed from ${channel}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const stickies = listStickies(guildId);
      if (!stickies.length) {
        await interaction.reply({
          content: '📭 No sticky messages configured.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const lines = stickies.map((s) => {
        const ch = interaction.guild.channels.cache.get(s.channelId);
        return `• ${ch?.toString() || s.channelId} — every ${s.interval} message${s.interval === 1 ? '' : 's'}`;
      });
      await interaction.reply({
        content: `📌 Sticky messages:\n${lines.join('\n')}`,
        flags: MessageFlags.Ephemeral,
      });
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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (
        getUserPlan(interaction.user.id) === 'free' &&
        getCustomRules().length >= FREE_CUSTOM_RULE_LIMIT
      ) {
        await interaction.reply({
          content: `⛔ The Free plan is limited to ${FREE_CUSTOM_RULE_LIMIT} custom rules. Subscribe to Pro for unlimited rules (/subscribe).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const rule = addCustomRule(title, description);
      await interaction.reply({
        content: `✅ Added rule **${rule.title}** (\`${rule.id}\`).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'removerule') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to remove rules.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const id = interaction.options.getString('id');
      const ok = removeCustomRule(id);
      await interaction.reply({
        content: ok
          ? '✅ Rule removed.'
          : '❌ That rule was not found (only custom rules can be removed).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'postrules') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to post rules.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await channel.send({
        embeds: [buildRulesEmbed('📜 Server Rules', guildName)],
      });
      await interaction.reply({
        content: `📢 Rules posted in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'announce') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to make announcements.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const message = interaction.options.getString('message');
      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await channel.send(message);
      await interaction.reply({
        content: `📢 Announcement posted in ${channel}.`,
        flags: MessageFlags.Ephemeral,
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
        await interaction.reply({ content: permErr, flags: MessageFlags.Ephemeral });
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
          await interaction.reply({ content: modErr, flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await interaction.guild.bans.create(user.id, {
        reason: `Banned by ${interaction.user.tag} — ${reason}`,
      });
      await interaction.reply({
        content: `✅ Banned **${user.tag}** (${reason}).`,
        flags: MessageFlags.Ephemeral,
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
        await interaction.reply({ content: permErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const member = interaction.options.getMember('user');
      const modErr = canModerate(interaction, member);
      if (modErr) {
        await interaction.reply({ content: modErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      await member.kick(`Kicked by ${interaction.user.tag} — ${reason}`);
      await interaction.reply({
        content: `✅ Kicked **${member.user.tag}** (${reason}).`,
        flags: MessageFlags.Ephemeral,
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
        await interaction.reply({ content: permErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const member = interaction.options.getMember('user');
      const modErr = canModerate(interaction, member);
      if (modErr) {
        await interaction.reply({ content: modErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const ms = parseDuration(interaction.options.getString('duration'));
      if (ms == null || ms <= 0) {
        await interaction.reply({
          content:
            '❌ Invalid duration — use e.g. `30s`, `10m`, `1h`, or `2d`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (ms > 28 * 24 * 60 * 60 * 1000) {
        await interaction.reply({
          content: '❌ Timeouts can be at most 28 days.',
          flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
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
        await interaction.reply({ content: permErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const amount = interaction.options.getInteger('amount');
      const user = interaction.options.getUser('user') ?? null;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const config = getVerificationConfig(interaction.guild?.id);
      if (!config.roleId) {
        await interaction.reply({
          content:
            '❌ Configure a verified role in the dashboard before posting a verification panel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'verify') {
      await sendVerificationLink(interaction);
      return;
    }

    // ---------- Automation (autorole + role restore) ----------
    if (commandName === 'autorole') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to manage autoroles.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const paidErr = requirePaid(interaction, 'Automation');
      if (paidErr) {
        await interaction.reply({ content: paidErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const sub = interaction.options.getSubcommand();
      if (sub === 'add') {
        const role = interaction.options.getRole('role');
        const config = addAutoroleRole(interaction.guild.id, role.id);
        await interaction.reply({
          content: `✅ ${role} will now be assigned to new members (${config.roleIds.length} autorole${config.roleIds.length === 1 ? '' : 's'}).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        const config = removeAutoroleRole(interaction.guild.id, role.id);
        await interaction.reply({
          content: `✅ ${role} removed from autoroles (${config.roleIds.length} autorole${config.roleIds.length === 1 ? '' : 's'}).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const roleIds = getAutoroleConfig(interaction.guild.id).roleIds;
      const names = roleIds
        .map(
          (id) =>
            interaction.guild.roles.cache.get(id)?.toString() || `\`${id}\``
        )
        .join(', ');
      await interaction.reply({
        content: roleIds.length
          ? `📜 Autoroles: ${names}`
          : '📜 No autoroles configured.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'restoreroles') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to change role restore.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const paidErr = requirePaid(interaction, 'Automation');
      if (paidErr) {
        await interaction.reply({ content: paidErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const sub = interaction.options.getSubcommand();
      if (sub === 'enable') {
        setRestoreEnabled(interaction.guild.id, true);
        await interaction.reply({
          content:
            '✅ Role restore enabled — members will get their roles back when they rejoin.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'disable') {
        setRestoreEnabled(interaction.guild.id, false);
        await interaction.reply({
          content: '✅ Role restore disabled.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const enabled = isRestoreEnabled(interaction.guild.id);
      await interaction.reply({
        content: enabled
          ? '✅ Role restore is enabled.'
          : '❌ Role restore is disabled.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ---------- Tickets ----------
    if (commandName === 'ticket') {
      await openTicket(interaction);
      return;
    }

    if (commandName === 'ticketsetup') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to configure tickets.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const paidErr = requirePaid(interaction, 'Tickets');
      if (paidErr) {
        await interaction.reply({ content: paidErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const category = interaction.options.getChannel('category');
      const staffRole = interaction.options.getRole('staffrole');
      if (category?.type !== ChannelType.GuildCategory) {
        await interaction.reply({
          content: '❌ The category must be a channel category.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      setTicketConfig(interaction.guild.id, {
        categoryId: category.id,
        staffRoleId: staffRole.id,
      });
      await interaction.reply({
        content: `✅ Ticket system configured — category ${category}, staff role ${staffRole}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'ticketpanel') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to post a ticket panel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const paidErr = requirePaid(interaction, 'Tickets');
      if (paidErr) {
        await interaction.reply({ content: paidErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const config = getTicketConfig(interaction.guild.id);
      if (!config.categoryId || !config.staffRoleId) {
        await interaction.reply({
          content: '❌ Configure the ticket system first with `/ticketsetup`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const channel =
        interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: '❌ Please provide a valid text channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open')
          .setLabel('Open ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );
      const message = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle('🎫 Support Tickets')
            .setDescription('Click the button below to open a support ticket.'),
        ],
        components: [row],
      });
      savePanel(interaction.guild.id, channel.id, message.id);
      await interaction.reply({
        content: `✅ Ticket panel posted in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ---------- Appeals ----------
    if (commandName === 'appeal') {
      const guild = await resolveAppealGuild(interaction);
      if (!guild) {
        await interaction.reply({
          content:
            "❌ I couldn't find that server. When DMing the bot, include the exact server name with `/appeal server:...`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const appeal = createAppeal({
        guildId: guild.id,
        guildName: guild.name,
        userId: interaction.user.id,
        username: interaction.user.username,
        reason: interaction.options.getString('reason'),
      });
      await interaction.reply({
        content: `✅ Your appeal for **${guild.name}** was submitted (ID \`${appeal.id}\`). Staff will review it soon.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'appeals') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to review appeals.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const paidErr = requirePaid(interaction, 'Appeals');
      if (paidErr) {
        await interaction.reply({ content: paidErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      if (sub === 'list') {
        const status = interaction.options.getString('status') || null;
        const appeals = listAppeals({ guildId, status }).slice(0, 10);
        if (!appeals.length) {
          await interaction.reply({
            content: '📭 No appeals found.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('🪧 Ban Appeals')
          .setDescription(
            appeals
              .map(
                (a) =>
                  `\`${a.id}\` · **${a.status.toUpperCase()}** · ${a.username || a.userId || 'Unknown'}\n${a.reason.slice(0, 120)}`
              )
              .join('\n\n')
          )
          .setTimestamp();
        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'review') {
        const id = interaction.options.getString('id');
        const decision = interaction.options.getString('decision');
        const note = interaction.options.getString('note') || null;
        const appeal = getAppeal(id);
        if (!appeal || appeal.guildId !== guildId) {
          await interaction.reply({
            content: '❌ Appeal not found.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (appeal.status !== 'pending') {
          await interaction.reply({
            content: `❌ Appeal \`${id}\` has already been ${appeal.status}.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (decision === 'approve' && appeal.userId) {
          try {
            await interaction.guild.bans.remove(
              appeal.userId,
              `Appeal approved by ${interaction.user.tag}`
            );
          } catch (err) {
            console.error('[appeal] unban failed:', err.message);
          }
        }
        reviewAppeal(id, {
          status: decision === 'approve' ? 'approved' : 'denied',
          reviewedBy: interaction.user.tag,
          note,
        });
        await interaction.reply({
          content: `✅ Appeal \`${id}\` ${decision === 'approve' ? 'approved — user unbanned.' : 'denied.'}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      return;
    }

    // ---------- Leveling ----------
    if (commandName === 'rank') {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const xp = getUserXp(interaction.guild.id, user.id);
      const progress = xpProgress(xp);
      const rank = getRank(interaction.guild.id, user.id);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setTitle(`Level ${progress.level}`)
        .setDescription(`${xp.toLocaleString()} XP`)
        .addFields(
          {
            name: 'Rank',
            value: rank ? `#${rank}` : 'Unranked',
            inline: true,
          },
          {
            name: 'Progress',
            value: `${progress.progressXp.toLocaleString()} / ${progress.neededXp.toLocaleString()} XP`,
            inline: true,
          }
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (commandName === 'leaderboard') {
      const board = getLeaderboard(interaction.guild.id, 10);
      if (!board.length) {
        await interaction.reply({
          content: '📭 No one has earned XP yet. Start chatting!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const lines = board.map((entry, i) => {
        const member = interaction.guild.members.cache.get(entry.userId);
        const name = member?.user.tag ?? entry.userId;
        return `**${i + 1}.** ${name} — Level ${entry.level} · ${entry.xp.toLocaleString()} XP`;
      });
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🏆 XP Leaderboard')
        .setDescription(lines.join('\n'))
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (commandName === 'leveling') {
      if (!isModerator(interaction)) {
        await interaction.reply({
          content:
            '⛔ You need the **Manage Server** permission to configure leveling.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const paidErr = requirePaid(interaction, 'Leveling');
      if (paidErr) {
        await interaction.reply({ content: paidErr, flags: MessageFlags.Ephemeral });
        return;
      }
      const sub = interaction.options.getSubcommand();
      if (sub === 'channel') {
        const channel = interaction.options.getChannel('channel');
        if (!channel?.isTextBased()) {
          await interaction.reply({
            content: '❌ Please provide a text channel.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        setLevelConfig(interaction.guild.id, {
          levelUpChannelId: channel.id,
        });
        await interaction.reply({
          content: `✅ Level-up messages will be sent to ${channel}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'announce') {
        const value = interaction.options.getString('value');
        const config = setLevelConfig(interaction.guild.id, {
          announce: value === 'on',
        });
        await interaction.reply({
          content: `✅ Level-up announcements ${config.announce ? 'enabled' : 'disabled'}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'voicexp') {
        const amount = interaction.options.getInteger('amount');
        const config = setLevelConfig(interaction.guild.id, {
          voiceXpPerMinute: amount,
        });
        await interaction.reply({
          content: `✅ Voice XP set to ${config.voiceXpPerMinute} XP/minute.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'reset') {
        const user = interaction.options.getUser('user');
        const ok = resetUserXp(interaction.guild.id, user.id);
        await interaction.reply({
          content: ok
            ? `✅ Reset ${user.tag}'s XP.`
            : '❌ That user has no XP yet.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'resetall') {
        const ok = resetGuildXp(interaction.guild.id);
        await interaction.reply({
          content: ok
            ? '✅ Reset all XP in this server.'
            : '❌ There was no XP to reset.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      return;
    }
  } catch (err) {
    console.error('[bot] interaction error:', err);
    const payload = { content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral };
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
      GatewayIntentBits.GuildVoiceStates,
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

    await syncDiscordBotListCommands(client);
    await syncDiscordBotListStats(client);

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

    try {
      await applyAutomationOnJoin(member);
    } catch (err) {
      console.error(
        `[automation] failed for ${member.user.tag}:`,
        err.message
      );
    }
  });

  client.on('guildMemberRemove', (member) => {
    try {
      saveRolesOnLeave(member);
    } catch (err) {
      console.error(
        `[restore] failed to save roles for ${member.user.tag}:`,
        err.message
      );
    }
  });

  client.on('guildCreate', () => updateStats(client));
  client.on('guildDelete', () => updateStats(client));
  client.on('interactionCreate', handleInteraction);

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const result = addMessageXp(message.guild.id, message.author.id);
    if (result?.leveledUp) {
      const member = await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);
      if (member) await announceLevelUp(message.guild, member, result);
    }
    handleStickyRepost(message).catch((err) => {
      console.error('[sticky] repost failed:', err.message);
    });
  });

  await client.login(token);
  const reminderTimer = setInterval(() => {
    sendDueVoteReminders(client).catch((error) => {
      console.error('[vote] reminder error:', error.message);
    });
  }, 10 * 60 * 1000);
  reminderTimer.unref?.();

  const voiceXpTimer = setInterval(() => {
    awardVoiceXp(client).catch((error) => {
      console.error('[leveling] voice XP error:', error.message);
    });
  }, 60 * 1000);
  voiceXpTimer.unref?.();

  const statsTimer = setInterval(() => {
    syncDiscordBotListStats(client);
  }, 30 * 60 * 1000);
  statsTimer.unref?.();
  return client;
}
