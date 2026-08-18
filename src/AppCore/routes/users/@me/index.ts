/* Copyright Elysia © 2025. All rights reserved */

import { APIUser } from "discord-api-types/v10";
import { Router } from "express";
import Constants from "src/AppCore/Constants";

const app = Router({ mergeParams: true });

app.get("/", async (req, res) => {
    try {
        const r = await fetch("https://canary.discord.com/api/v9/users/@me", {
            headers: {
                authorization: req.headers.authorization || "",
                "user-agent": Constants.UserAgentDiscordBot,
            },
        });

        const data = await r.json();

        if (r.ok) {
            const user = data as APIUser;
            res.status(200).send({
                ...user,
                premium: true,
                premium_type: 1,
                mfa_enabled: 1,
                flags: 476111,
                public_flags: 476111,
                phone: "33550336",
                verified: true,
                nsfw_allowed: true,
                email: `${user.id}@cyrene.moe`,
                purchased_flags: 3,
            });
        } else {
            res.status(r.status).send(data);
        }
    } catch (err) {
        console.error("Error fetching /users/@me:", err);
        res.status(500).send({ message: "Internal Server Error" });
    }
});

export default app;
