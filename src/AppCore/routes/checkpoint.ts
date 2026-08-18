/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        card_id: 0,
        avatar_decoration: null,
        power_level: 0,
        power_level_percentile: 0,
        messages: {
            num_messages_sent: 1000,
            num_messages_sent_percentile: 64,
            top_month: {
                month: 12,
                num_messages_sent: 123,
            },
        },
        emojis: {
            num_emojis_sent: 1000,
            emojis: [
                {
                    name: "🔥",
                },
                {
                    name: "✨",
                },
                {
                    name: "😱",
                },
                {
                    name: "🐧",
                },
                {
                    name: "🙃",
                },
                /*
                {
                    id: "emoji_id",
                    name: "emoji_name",
                    animated: false,
                },
                */
            ],
        },
        voice: {
            total_voice_minutes: 36 * 60,
            total_voice_minutes_percentile: null,
            top_month: {
                month: 12,
                num_minutes_in_voice: 18 * 60,
            },
        },
        guilds: {
            num_guilds_joined: 1,
            // guilds: { num_messages_sent: number, num_voice_minutes: number, guild: APIGuild }[];
            guilds: [],
        },
        // sidekick: { user: APIUser, num_messages_sent: number, num_voice_minutes: number }
        sidekick: null,
        // The discord friend you spent the most time with this year
        // users: { user: APIUser }[];
        users: [],
        // Games
        applications: {
            total_games_played: 1,
            applications: [
                {
                    num_sessions: 1,
                    game: {
                        id: "1402418239342120960",
                        name: "osu!",
                        icon_hash: "ea86f6c52576847a7cb81f1c1faa18a3",
                        banner_hash: "8029278a3fab0e30108bd335f26ab8a0",
                        cover_image_hash: "b76db81b683527961ee1432c24a02774",
                    },
                },
            ],
        },
        quests: {
            num_completed: 0,
            num_orbs: 0,
        },
    });
});

export default app;
