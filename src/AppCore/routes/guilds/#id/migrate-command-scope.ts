/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.post("/", (req, res) => {
    res.send({
        integration_ids_with_app_commands: [],
    });
});

export default app;
