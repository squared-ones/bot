import { PermissionFlagsBits } from 'discord.js';

// Maps a moderation action to the Discord permission it requires.
export const ACTION_PERMISSIONS = {
  ban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  purge: PermissionFlagsBits.ManageMessages,
};

export const ACTION_LABELS = {
  ban: 'Ban Members',
  kick: 'Kick Members',
  timeout: 'Moderate Members',
  purge: 'Manage Messages',
};

// Parses a duration like "30s", "10m", "1h", "2d" (bare numbers = minutes).
export function parseDuration(input) {
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

export function formatDuration(ms) {
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

// Fetches a guild member by ID (uses cache first), or null if absent.
export async function getMember(guild, userId) {
  if (!userId) return null;
  return guild.members.fetch(userId).catch(() => null);
}

// Returns an error string if the actor (or the bot) lacks a permission.
export function permissionError(guild, actorMember, permission, label) {
  if (!actorMember) return 'You are not a member of this server.';
  if (
    actorMember.id !== guild.ownerId &&
    !actorMember.permissions.has(permission)
  ) {
    return `You need the **${label}** permission in this server.`;
  }
  const me = guild.members.me;
  if (me && !me.permissions.has(permission)) {
    return `The bot is missing the **${label}** permission in this server.`;
  }
  return null;
}

// Returns an error string if a moderation action would violate role hierarchy.
// `actorMember` may be null (OAuth-disabled "dev mode") — actor-side checks are
// skipped, but owner and bot-hierarchy checks still apply.
export function hierarchyError(guild, actorMember, targetMember) {
  if (!targetMember) return 'That user is not in this server.';
  if (actorMember && targetMember.id === actorMember.id) {
    return "You can't moderate yourself.";
  }
  if (targetMember.id === guild.ownerId) {
    return "You can't moderate the server owner.";
  }
  if (actorMember && actorMember.id !== guild.ownerId) {
    if (
      targetMember.roles.highest.position >= actorMember.roles.highest.position
    ) {
      return "You can't moderate someone with an equal or higher role.";
    }
  }
  const me = guild.members.me;
  if (me && targetMember.roles.highest.position >= me.roles.highest.position) {
    return "The bot can't moderate someone with a higher role than it.";
  }
  return null;
}

// True if the member has at least one moderation permission (or owns the guild).
export function hasAnyModerationPermission(guild, member) {
  if (!member) return false;
  if (guild.ownerId === member.id) return true;
  return Object.values(ACTION_PERMISSIONS).some((p) =>
    member.permissions.has(p)
  );
}

export async function banUser(guild, userId, reason) {
  await guild.bans.create(userId, { reason });
}

export async function kickMember(member, reason) {
  await member.kick(reason);
}

export async function timeoutMember(member, ms, reason) {
  await member.timeout(ms, reason);
}

// Deletes recent messages; `user` may be a User object or a user ID string.
export async function purgeMessages(channel, amount, user) {
  if (!channel?.isTextBased()) return 0;
  const fetched = await channel.messages.fetch({ limit: amount });
  const id = typeof user === 'string' ? user : user?.id;
  const targets = id ? fetched.filter((m) => m.author.id === id) : fetched;
  if (targets.size === 0) return 0;
  if (targets.size === 1) {
    await targets.first().delete();
    return 1;
  }
  const deleted = await channel.bulkDelete(targets, true);
  return deleted.size;
}
