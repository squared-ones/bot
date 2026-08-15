import { EmbedBuilder } from 'discord.js';

const MAX = {
  title: 256,
  description: 4096,
  author: 256,
  footer: 2048,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
};

function truncate(value, n) {
  return String(value ?? '').slice(0, n);
}

// Accepts "#RRGGBB" or "RRGGBB" and returns a numeric color, or null if invalid.
export function parseColor(str) {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? parseInt(m[1], 16) : null;
}

function isValidUrl(str) {
  if (!str) return true;
  try {
    const u = new URL(String(str).trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function embedHasContent(spec = {}) {
  return Boolean(
    (spec.title && String(spec.title).trim()) ||
      (spec.description && String(spec.description).trim()) ||
      (spec.author && String(spec.author).trim()) ||
      (spec.footer && String(spec.footer).trim()) ||
      (spec.thumbnail && String(spec.thumbnail).trim()) ||
      (spec.image && String(spec.image).trim()) ||
      (Array.isArray(spec.fields) &&
        spec.fields.some(
          (f) =>
            f &&
            (String(f.name ?? '').trim() || String(f.value ?? '').trim())
        ))
  );
}

// Returns an error string, or null when the spec is valid.
export function validateEmbedSpec(spec = {}) {
  if (!embedHasContent(spec)) {
    return 'Embed needs at least a title, description, field, image, thumbnail, author, or footer.';
  }
  if (spec.title !== undefined && typeof spec.title !== 'string') {
    return 'title must be a string';
  }
  if (spec.description !== undefined && typeof spec.description !== 'string') {
    return 'description must be a string';
  }
  if (spec.color !== undefined && parseColor(spec.color) === null) {
    return 'color must be a hex value like #5865F2';
  }
  if (spec.thumbnail !== undefined && !isValidUrl(spec.thumbnail)) {
    return 'thumbnail must be an http(s) URL';
  }
  if (spec.image !== undefined && !isValidUrl(spec.image)) {
    return 'image must be an http(s) URL';
  }
  if (spec.fields !== undefined && !Array.isArray(spec.fields)) {
    return 'fields must be an array';
  }
  if (Array.isArray(spec.fields)) {
    if (spec.fields.length > MAX.fields) {
      return `too many fields (max ${MAX.fields})`;
    }
    for (const f of spec.fields) {
      if (!f || typeof f !== 'object') return 'each field must be an object';
      if (f.name !== undefined && typeof f.name !== 'string') {
        return 'field name must be a string';
      }
      if (f.value !== undefined && typeof f.value !== 'string') {
        return 'field value must be a string';
      }
    }
  }
  return null;
}

// Builds a Discord EmbedBuilder from a user-supplied spec.
export function buildEmbedFromSpec(spec = {}) {
  const embed = new EmbedBuilder();

  if (spec.title) embed.setTitle(truncate(spec.title, MAX.title));
  if (spec.description) {
    embed.setDescription(truncate(spec.description, MAX.description));
  }

  const color = parseColor(spec.color);
  if (color !== null) embed.setColor(color);

  if (spec.author) {
    embed.setAuthor({ name: truncate(spec.author, MAX.author) });
  }
  if (spec.footer) {
    embed.setFooter({ text: truncate(spec.footer, MAX.footer) });
  }
  if (spec.thumbnail) embed.setThumbnail(String(spec.thumbnail).trim());
  if (spec.image) embed.setImage(String(spec.image).trim());
  if (spec.timestamp) embed.setTimestamp(new Date());

  for (const f of Array.isArray(spec.fields) ? spec.fields : []) {
    if (!f) continue;
    const name = truncate(f.name, MAX.fieldName);
    const value = truncate(f.value, MAX.fieldValue);
    if (!name && !value) continue;
    embed.addFields({
      name: name || '\u200b',
      value,
      inline: Boolean(f.inline),
    });
  }

  return embed;
}
