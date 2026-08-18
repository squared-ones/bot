/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        quests: [],
        excluded_quests: [],
        quest_enrollment_blocked_until: null,
    });
});

export default app;
