/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";
import Constants from "src/AppCore/Constants";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        code: 0,
        message: "OK",
        version: Constants.AppVersion,
        isBotClient: req.headers["user-agent"]?.includes("DiscordBotClient") || false,
    });
});

export default app;
