/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        categories: {
            social: true,
            communication: true,
            recommendations_and_events: false,
            tips: false,
            updates_and_announcements: false,
        },
        initialized: true,
    });
});

export default app;
