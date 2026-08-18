/* Copyright Elysia © 2025. All rights reserved */

import { DiscordSnowflake } from "@sapphire/snowflake";
import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        applications: [],
        application_commands: [],
        version: DiscordSnowflake.generate().toString(),
    });
});

export default app;
