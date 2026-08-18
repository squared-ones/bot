/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    return res.redirect("https://github.com/aiko-chan-ai/DiscordBotClient/releases");
});

export default app;
