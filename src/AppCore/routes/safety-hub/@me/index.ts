/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        classifications: [],
        guild_classifications: [],
        account_standing: {
            state: 100,
        },
    });
});

export default app;
