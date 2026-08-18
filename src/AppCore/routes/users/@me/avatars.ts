/* Copyright Elysia © 2026. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        avatars: [],
    });
});

export default app;
