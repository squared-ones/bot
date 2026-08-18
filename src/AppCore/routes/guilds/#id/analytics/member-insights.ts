/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        has_access_rate: false,
        access_rate: null,
        last_updated: null,
    });
});

export default app;
