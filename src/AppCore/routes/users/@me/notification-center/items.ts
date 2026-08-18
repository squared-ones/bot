/* Copyright Elysia © 2025. All rights reserved */

import { DiscordSnowflake } from "@sapphire/snowflake";
import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        limit: 20,
        items: [],
        cursor: DiscordSnowflake.generate().toString(),
        has_more: false,
    });
});

export default app;
