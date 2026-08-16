import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { queueDataSync, resolveDataDir } from './github-data.js';

const DATA_DIR = resolveDataDir();
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

// Default rules ship with the bot and can never be removed.
const DEFAULT_RULES = [
  {
    id: 'default-1',
    title: '📜 Community Rules & Guidelines',
    description:
      'Welcome to our Discord community. By joining this server, you agree to follow all rules outlined below. ' +
      'These rules are in place to ensure that everyone can enjoy a safe, welcoming, respectful, and enjoyable environment. ' +
      'Failure to comply with these rules may result in moderation actions, including warnings, mutes, kicks, temporary bans, ' +
      'permanent bans, or any other action deemed appropriate by the moderation team.\n\n' +
      'The moderation team reserves the right to interpret these rules and make decisions in situations not explicitly covered below. ' +
      'Attempting to exploit loopholes or technicalities within these rules will not exempt members from moderation.',
  },
  {
    id: 'default-2',
    title: '1. Respect All Members',
    description:
      'Every member deserves to be treated with respect regardless of their age, nationality, race, ethnicity, religion, gender, sexual orientation, identity, opinions, or experience.\n\n' +
      'Members must:\n' +
      '- Remain polite and respectful.\n' +
      '- Accept differing opinions.\n' +
      '- Engage in civil discussions.\n' +
      '- Avoid unnecessary arguments.\n' +
      '- Treat newcomers with kindness.\n' +
      '- Respect moderators and staff members.\n\n' +
      'The following behaviour is prohibited:\n' +
      '- Harassment.\n'+
      '- Personal attacks. \n'+
      '- Bullying.\n'+
      '- Name-calling.\n'+
      '- Insults.\n'+
      '- Hate speech.\n'+
      '- Discrimination.\n'+
      '- Threats.\n'+
      '- Targeted harassment.\n'+
      '- Witch hunting.\n'+
      '- Public shaming.\n'+
      '- Encouraging others to harass another member.',
  },
  {
    id: 'default-3',
    title: "2. Follow Discord's Terms of Service",
    description:
      "All users must comply with Discord's Terms of Service and Community Guidelines at all times.\n\n" +
      'This includes—but is not limited to—prohibitions against:\n' +
      '- Underage accounts.\n' +
      '- Illegal content.\n' +
      '- Violent extremist content.\n' +
      '- Terrorist content.\n' +
      '- Distribution of malware.\n' +
      '- Account theft.\n' +
      '- Fraud.\n' +
      '- Phishing.\n' +
      '- Identity impersonation.\n' +
      '- Sale or distribution of stolen accounts.\n' +
      '- Unauthorized access to services.\n' +
      "- Any activity that violates Discord's policies.\n\n" +
      "Violation of Discord's Terms of Service may result in immediate removal from this server.",
  },
  {
    id: 'default-4',
    title: '3. Keep Conversations Appropriate',
    description:
      'Please keep all conversations suitable for a general audience.\n\n' +
      'The following content is prohibited:\n' +
      '- Pornographic material.\n' +
      '- Explicit sexual discussions.\n' +
      '- Graphic violence or gore.\n' +
      '- Shock content.\n' +
      '- Fetishes.\n' +
      '- Excessively disturbing material.\n' +
      '- Offensive memes intended solely to provoke.\n' +
      '- Content that may make members uncomfortable.\n\n' +
      'Discussions involving mature topics should remain respectful, educational, and appropriate.',
  },
  {
    id: 'default-5',
    title: '4. No Spam or Flooding',
    description:
      'Spam disrupts conversations and negatively impacts the community.\n\n' +
      'Examples of spam include:\n' +
      '- Repeating identical messages.\n' +
      '- Sending excessive emojis.\n' +
      '- Emoji walls.\n' +
      '- GIF spam.\n' +
      '- Sticker spam.\n' +
      '- Character spam.\n' +
      '- Keyboard smashing.\n' +
      '- Excessive capitalization.\n' +
      '- Flooding channels.\n' +
      '- Chain messages.\n' +
      '- Random or meaningless text.\n' +
      '- Rapidly sending multiple messages.\n' +
      '- Intentionally disrupting conversations.\n\n' +
      'Use channels for their intended purpose.',
  },
  {
    id: 'default-6',
    title: '5. Stay On Topic',
    description:
      'Each channel exists for a specific purpose.\n\n' +
      'Members should:\n' +
      '- Use the correct channels.\n' +
      '- Avoid derailing conversations.\n' +
      '- Keep discussions relevant.\n' +
      '- Move unrelated discussions elsewhere when appropriate.\n\n' +
      'Persistent off-topic behaviour may result in moderation.',
  },
  {
    id: 'default-7',
    title: '6. No Advertising or Self-Promotion',
    description:
      'Advertising is not permitted without prior approval from the staff team.\n\n' +
      'This includes:\n' +
      '- Discord servers.\n' +
      '- Websites.\n' +
      '- Businesses.\n' +
      '- YouTube channels.\n' +
      '- Twitch streams.\n' +
      '- TikTok accounts.\n' +
      '- Social media.\n' +
      '- Affiliate links.\n' +
      '- Referral links.\n' +
      '- Paid services.\n' +
      '- Products.\n' +
      '- Giveaways.\n' +
      '- Crowdfunding campaigns.\n\n' +
      'Staff-approved partnerships are exempt.',
  },
  {
    id: 'default-8',
    title: '7. No Scams or Fraud',
    description:
      'Any attempt to deceive, manipulate, or scam members is strictly prohibited.\n\n' +
      'Examples include:\n' +
      '- Fake giveaways.\n' +
      '- Phishing.\n' +
      '- Fake Nitro offers.\n' +
      '- Cryptocurrency scams.\n' +
      '- Investment scams.\n' +
      '- Fake support.\n' +
      '- Fake downloads.\n' +
      '- Malware distribution.\n' +
      '- Social engineering.\n' +
      '- Impersonating staff.\n\n' +
      'These offences typically result in an immediate permanent ban if it is you or you will be quarantined by machines.',
  },
  {
    id: 'default-9',
    title: '8. Respect Privacy',
    description:
      'Everyone has a right to privacy.\n\n' +
      'Do not:\n' +
      '- Share private conversations without permission.\n' +
      '- Reveal personal information.\n' +
      '- Doxx users.\n' +
      '- Leak addresses.\n' +
      '- Leak phone numbers.\n' +
      '- Leak emails.\n' +
      '- Leak passwords.\n' +
      '- Leak financial information.\n' +
      '- Share confidential information.\n\n' +
      'Obtaining or sharing another person\'s private information without consent is strictly forbidden.',
  },
  {
    id: 'default-10',
    title: '9. Appropriate Usernames & Avatars',
    description:
      'Your profile visible within this server should remain appropriate.\n\n' +
      'The following are prohibited:\n' +
      '- Offensive usernames.\n' +
      '- Hate symbols.\n' +
      '- NSFW profile pictures.\n' +
      '- Graphic imagery.\n' +
      '- Offensive banners.\n' +
      '- Impersonation of staff.\n' +
      '- Misleading identities.\n' +
      '- Inappropriate bios.\n\n' +
      'Staff may request profile changes at any time.',
  },
  {
    id: 'default-11',
    title: '10. No Impersonation',
    description:
      'Do not pretend to be:\n\n' +
      '- Staff.\n' +
      '- Administrators.\n' +
      '- Moderators.\n' +
      '- Developers.\n' +
      '- Content creators.\n' +
      '- Other members.\n' +
      '- Discord employees.\n' +
      '- Partner organizations.\n\n' +
      'Intentionally misleading members may result in disciplinary action.',
  },
  {
    id: 'default-12',
    title: '11. Use Common Sense',
    description:
      'Not every situation can be covered by written rules.\n\n' +
      'Members are expected to:\n' +
      '- Act responsibly.\n' +
      '- Think before posting.\n' +
      '- Avoid intentionally causing problems.\n' +
      '- Help maintain a positive atmosphere.\n\n' +
      'Attempting to exploit loopholes in these rules may still result in moderation.',
  },
  {
    id: 'default-13',
    title: '12. No Trolling or Baiting',
    description:
      'Deliberately provoking members for reactions is prohibited.\n\n' +
      'Examples include:\n' +
      '- Flame bait.\n' +
      '- Rage bait.\n' +
      '- Deliberately spreading misinformation.\n' +
      '- Intentionally annoying others.\n' +
      '- Fake announcements.\n' +
      '- Fake moderation messages.\n' +
      '- False accusations.\n\n' +
      'Healthy humour is encouraged; disruptive trolling is not.',
  },
  {
    id: 'default-14',
    title: '13. Follow Staff Instructions',
    description:
      'Staff decisions are made to protect the community.\n\n' +
      'Members must:\n' +
      '- Cooperate during investigations.\n' +
      '- Follow moderator instructions.\n' +
      '- Respect temporary restrictions.\n' +
      '- Avoid arguing in public channels.\n\n' +
      'If you disagree with a moderation action, use the designated appeal process instead of disrupting the server.',
  },
  {
    id: 'default-15',
    title: '14. Report Problems Properly',
    description:
      'If you encounter:\n\n' +
      '- Rule violations.\n' +
      '- Harassment.\n' +
      '- Spam.\n' +
      '- Scams.\n' +
      '- Bugs.\n' +
      '- Exploits.\n\n' +
      'Please report them through the appropriate support channel or ticket system.\n\n' +
      'Do not publicly start arguments or attempt to moderate other members yourself.',
  },
  {
    id: 'default-16',
    title: '15. English Unless Otherwise Allowed',
    description:
      'Unless a specific channel states otherwise, please communicate in English.\n\n' +
      'This allows moderators to effectively review conversations and ensures everyone can participate.',
  },
  {
    id: 'default-17',
    title: '16. No Alternate Accounts to Evade Punishments',
    description:
      'Using alternate accounts to:\n\n' +
      '- Bypass bans.\n' +
      '- Avoid mutes.\n' +
      '- Circumvent slowmode.\n' +
      '- Evade moderation.\n' +
      '- Continue harassment.\n\n' +
      'will result in additional enforcement against all related accounts.',
  },
  {
    id: 'default-18',
    title: '17. Voice Channel Etiquette',
    description:
      'When using voice channels:\n\n' +
      '- Be respectful.\n' +
      '- Avoid excessive background noise.\n' +
      '- Do not intentionally scream.\n' +
      '- Avoid soundboards that disrupt conversations.\n' +
      '- Do not play loud music without permission.\n' +
      '- Allow others to speak.\n\n' +
      'Moderators may disconnect disruptive users.',
  },
  {
    id: 'default-19',
    title: '18. Fair Use of Bots',
    description:
      'Bot commands should only be used in their designated channels.\n\n' +
      'Do not:\n' +
      '- Spam commands.\n' +
      '- Abuse bot exploits.\n' +
      '- Attempt to crash bots.\n' +
      '- Circumvent bot restrictions.\n' +
      '- Intentionally overload automated systems.',
  },
  {
    id: 'default-20',
    title: '19. No Exploiting Bugs',
    description:
      'If you discover:\n\n' +
      '- Server bugs.\n' +
      '- Bot vulnerabilities.\n' +
      '- Permission issues.\n' +
      '- Security flaws.\n\n' +
      'Please report them privately to staff.\n\n' +
      'Knowingly exploiting bugs for personal gain may result in immediate moderation.',
  },
  {
    id: 'default-21',
    title: '20. Moderation & Enforcement',
    description:
      'Moderation actions may include:\n\n' +
      '- Verbal reminders.\n' +
      '- Official warnings.\n' +
      '- Temporary restrictions.\n' +
      '- Slowmode restrictions.\n' +
      '- Mutes.\n' +
      '- Kicks.\n' +
      '- Temporary bans.\n' +
      '- Permanent bans.\n' +
      '- Removal of roles.\n' +
      '- Restriction from specific channels.\n\n' +
      'Punishments are issued based on severity, frequency, and previous behaviour.',
  },
  {
    id: 'default-22',
    title: '21. Appeals',
    description:
      'Members who believe a moderation action was issued unfairly may submit an appeal through the official appeals process.\n\n' +
      'Appeals should:\n' +
      '- Remain respectful.\n' +
      '- Include accurate information.\n' +
      '- Avoid dishonesty.\n' +
      '- Not contain harassment toward staff.\n\n' +
      'Submitting multiple duplicate appeals may result in the appeal being denied.',
  },
  {
    id: 'default-23',
    title: '22. Rule Updates',
    description:
      'These rules may be modified, expanded, or updated at any time without prior notice.\n\n' +
      'It is every member\'s responsibility to remain informed of the latest version.\n\n' +
      'Continued participation within the server constitutes acceptance of the current rules.',
  },
  {
   id: 'default-1',
   title: 'Final Notice',
   description:
     'Our goal is to build a respectful, friendly, and enjoyable community where everyone can participate comfortably. While these rules are comprehensive, they cannot cover every possible situation. The moderation team reserves the right to take appropriate action against behaviour that negatively impacts the community, even if it is not explicitly listed above.\n\n' +
     'Thank you for helping maintain a positive environment for everyone. We hope you enjoy your time in the server.',
  },
];

let customRules = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveRules() {
  ensureDataDir();
  fs.writeFileSync(RULES_FILE, JSON.stringify({ customRules }, null, 2));
  queueDataSync('Update rules');
}

export function loadRules() {
  ensureDataDir();
  if (fs.existsSync(RULES_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      customRules = Array.isArray(raw.customRules) ? raw.customRules : [];
    } catch {
      customRules = [];
    }
  }
  return getAllRules();
}

export function getAllRules() {
  return [...DEFAULT_RULES, ...customRules];
}

export function getCustomRules() {
  return [...customRules];
}

export function addCustomRule(title, description) {
  const rule = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    description: String(description).trim(),
    custom: true,
    createdAt: new Date().toISOString(),
  };
  customRules.push(rule);
  saveRules();
  return rule;
}

export function removeCustomRule(id) {
  const idx = customRules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  customRules.splice(idx, 1);
  saveRules();
  return true;
}

export function isDefaultRule(id) {
  return DEFAULT_RULES.some((r) => r.id === id);
}
