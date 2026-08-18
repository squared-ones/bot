/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send();
});

app.post("/", (req, res) => {
    return res.status(403).send({
        message: "APIServer: Bots cannot use this endpoint",
        code: 20001,
    });
});

export default app;
