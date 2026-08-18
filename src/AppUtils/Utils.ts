/* Copyright Elysia © 2025. All rights reserved */

import { APIGuildMember, APIUser } from "discord-api-types/v10";
import express from "express";
import https from "https";
import multer from "multer";
import GlobalConfig from "src/AppCore/Config";
import Constants from "src/AppCore/Constants";

import { UserFlagsBitField } from "./DiscordBitField";
import { BadgesBasedUserDataAndExtends as UserBadges } from "./UserBadges";

export default class Util {
    static ProfilePatch (
        userData: APIUser,
        guildMember: APIGuildMember | null = null,
        guildId: string | null = null,
        injectUserBio: string | null = null,
    ) {
        const fakeBio = "<a:shiggy:1162436090775470160> Based on the cutest Discord client mod :3";
        const flags = new UserFlagsBitField(userData.flags);
        const badges: object[] = [];
        flags.toArray().map(element => {
            // @ts-expect-error TS7053
            if (UserBadges[element]) {
                // @ts-expect-error TS7053
                badges.push(UserBadges[element]);
            }
        });
        if (userData.id !== Constants.UserIdDefault && GlobalConfig.config.generate_fake_profile) {
            if (userData.bot) {
                badges.push(
                    UserBadges.BotCommands,
                    UserBadges.ApplicationAutomod,
                    UserBadges.ApplicationGuildSubscription,
                );
            } else {
                badges.push(
                    UserBadges.PremiumDefault,
                    UserBadges.GuildBooster(9),
                    UserBadges.PremiumTenureV2(60),
                    UserBadges.LegacyUsername,
                    UserBadges.QuestCompleted,
                    UserBadges.AprilFools2026,
                    UserBadges.Gifting,
                );
            }
        }
        /*
		// https://github.com/discord/discord-api-docs/issues/6623
		if (userData.premium_type > 0) {
			badges.push(UserBadges.PREMIUM_DEFAULT);
			if (userData.premium_type == 2) {
				badges.push(UserBadges.GUILD_BOOSTER_LEVEL(9));
			}
			// Ruby
			badges.push(UserBadges.PREMIUM_TENURE(60));
		}
		*/
        if (!injectUserBio && GlobalConfig.config.generate_fake_profile) {
            injectUserBio = fakeBio;
        }
        let guildMemberProfileBio = null;
        if (guildMember && "bio" in guildMember && guildMember.bio) {
            guildMemberProfileBio = guildMember.bio;
        } else if (injectUserBio) {
            guildMemberProfileBio = injectUserBio;
        }
        return {
            application_role_connections: [],
            badges,
            connected_accounts: [],
            guild_badges: [],
            guild_member: guildMember,
            guild_member_profile: guildMember && {
                guild_id: guildId,
                pronouns: "",
                bio: guildMemberProfileBio,
                banner: guildMember.banner,
                accent_color: null,
                theme_colors: null,
                popout_animation_particle_type: null,
                emoji: null,
                profile_effect: null,
            },
            legacy_username: null,
            mutual_friends: [],
            mutual_friends_count: 0,
            mutual_guilds: [],
            premium_since: GlobalConfig.config.generate_fake_profile ? "2016-12-22T00:00:00.000000+00:00" : null,
            premium_guild_since: GlobalConfig.config.generate_fake_profile ? "2016-12-22T00:00:00.000000+00:00" : null,
            // Force enable Nitro features (Bot)
            premium_type: userData.bot ? 2 : userData.premium_type,
            profile_themes_experiment_bucket: 4,
            user: userData,
            user_profile: {
                accent_color: userData.accent_color,
                banner: userData.banner,
                bio: injectUserBio,
                collectibles: [],
                emoji: null,
                popout_animation_particle_type: null,
                profile_effect: null,
                pronouns: null,
                theme_colors: null,
            },
            widgets: [],
            wishlist_settings: {},
        };
    }
    static getIDFromToken (token = ""): string | null {
        if (!token) return null;
        token = token.replace(/^(Bot|Bearer)\s*/i, "");
        const parts = token.split(".");
        if (parts.length < 2) return null; // Token must have at least 2 parts (id.secret)
        try {
            const decoded = Buffer.from(parts[0], "base64").toString();
            // Discord user/bot IDs are numeric (snowflakes)
            if (!decoded || !/^\d+$/.test(decoded)) return null;
            return decoded;
        } catch {
            return null;
        }
    }

    static getDataFromRequest (
        req: express.Request,
        res: express.Response,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (rq: express.Request<any, any, any, any>, rs: express.Response) => unknown,
    ) {
        let data = "";
        // check content-type
        if (req.headers["content-type"] !== "application/json") {
            return multer().any()(req, res, function (err) {
                if (err) {
                    console.error("Multer Error:", err);
                }
                callback(req, res);
            });
        }
        req.on("data", function (chunk) {
            data += chunk;
        });
        req.on("end", function () {
            req.rawBody = data;
            if (data) {
                try {
                    req.body = JSON.parse(data);
                } catch (e) {
                    req.body = undefined;
                    console.error("JSON Parse Error:", e);
                }
            }
            callback(req, res);
        });
    }
    /**
     * Create a ISO Date string
     * Ex: 2024-12-25T14:14:53.033000+00:00
     * @param {number} addYear
     * @returns
     */
    static makeISODate (addYear = 0) {
        const date = new Date();
        date.setFullYear(date.getFullYear() + addYear);
        return date.toISOString().replace("Z", "000+00:00");
    }
    /**
     * Create a ISO Date string without milliseconds
     * Ex: 2024-12-25T14:18:15+00:00
     * @param {number} addYear
     * @returns
     */
    static makeISODateWithoutMilliseconds (addYear = 0) {
        const date = new Date();
        date.setFullYear(date.getFullYear() + addYear);
        return date.toISOString().replace(/\.\d+Z/, "+00:00");
    }
    /**
     * Compares two version strings and determines if `versionB` is newer than `versionA`.
     * Supports version strings in the format `major.minor.patch` with an optional prefix 'v'.
     *
     * @param versionA - The current version (e.g., "v1.2.3" or "1.2.3").
     * @param versionB - The new version to check (e.g., "v1.3.0" or "1.3.0").
     * @returns `true` if `versionB` is newer than `versionA`, otherwise `false`.
     */
    static isNewerVersion (versionA: string, versionB: string) {
        const normalizeVersion = (version: string) => version.replace(/^v/, "");

        const parseVersion = (version: string) => {
            const parts = version.split(".").map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) {
                throw new Error(`Invalid version format: ${version}`);
            }
            return parts;
        };

        const [vA, vB] = [normalizeVersion(versionA), normalizeVersion(versionB)].map(parseVersion);

        for (let i = 0; i < 3; i++) {
            if (vB[i] > vA[i]) return true;
            if (vB[i] < vA[i]) return false;
        }

        return false;
    }
    static async proxy (req: express.Request, res: express.Response) {
        const target = `https://canary.discord.com${req.originalUrl}`;

        // 1. Copy headers (Express -> upstream), skipping hop-by-hop headers.
        const skipHeaders = [
            "host",
            "connection",
            "content-length",
            "transfer-encoding",
            "upgrade",
            "origin",
            "referer",
        ];
        const headers: Record<string, unknown> = {};
        Object.entries(req.headers).forEach(([key, value]) => {
            if (value && !skipHeaders.includes(key.toLowerCase())) {
                headers[key] = value;
            }
        });

        // 2. Origin & Referer
        headers.Origin = "https://canary.discord.com";
        headers.Referer = "https://canary.discord.com/";

        const proxyReq = https.request(
            target,
            {
                method: req.method as string,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                headers: headers as any,
            },
            proxyRes => {
                res.status(proxyRes.statusCode || 500);
                const skipResHeaders = ["content-encoding", "content-length", "transfer-encoding"];
                Object.entries(proxyRes.headers).forEach(([key, value]) => {
                    if (value && !skipResHeaders.includes(key.toLowerCase())) {
                        try {
                            res.setHeader(key, value);
                        } catch {
                            //
                        }
                    }
                });
                proxyRes.pipe(res);
            },
        );

        proxyReq.on("error", err => {
            console.error("Proxy request error:", err);
            if (!res.headersSent) res.status(500).send({ error: err.message });
        });

        // 3. Pipe request body (Express -> upstream)
        if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "")) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            req.pipe(proxyReq as any);
        } else {
            proxyReq.end();
        }
    }
}
