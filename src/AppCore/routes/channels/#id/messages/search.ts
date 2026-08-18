/* Copyright Elysia © 2025. All rights reserved */

import crypto from "node:crypto";

import { APIMessage } from "discord-api-types/v10";
import { Request, Router } from "express";
import Constants from "src/AppCore/Constants";

const app = Router({ mergeParams: true });

app.get(
    "/",
    async (
        req: Request<
            {
                id: string;
            },
            unknown,
            unknown,
            {
                max_id?: string;
                min_id?: string;
                channel_id?: string;
            }
        >,
        res,
    ) => {
        const salt = Math.random().toString();
        const hash = crypto
            .createHash("md5")
            .update(salt + "elysia")
            .digest("hex");
        let { channel_id } = req.query;
        const { max_id, min_id } = req.query;
        let messages: APIMessage[] = [];
        channel_id ??= req.params.id;
        if (channel_id) {
            messages = await fetch(
                    "https://canary.discord.com/api/v9/channels/" +
                        channel_id +
                        `/messages?limit=25${max_id ? "&before=" + max_id : ""}${min_id ? "&after=" + min_id : ""}`,
                    {
                        headers: {
                            authorization: req.headers.authorization,
                            "user-agent": Constants.UserAgentDiscordBot,
                        } as Record<string, string>,
                    },
                )
                .then(r => r.json() as Promise<APIMessage[]>)
                .catch(() => []);
        }
        return res.status(200).send({
            analytics_id: hash,
            doing_deep_historical_index: false,
            total_results: messages.length,
            messages: messages.map(m => {
                return [{ ...m, hit: true }];
            }),
        });
    },
);

export default app;
