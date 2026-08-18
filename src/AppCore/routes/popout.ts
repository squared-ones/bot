/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/*splat", (req, res) => {
    fetch("https://canary.discord.com/popout")
        .then(r => r.text())
        .then(t => res.send(t))
        .catch(err => {
            console.error("Error fetching popout:", err);
            if (!res.headersSent) res.status(502).send("Failed to fetch popout page");
        });
});

export default app;
