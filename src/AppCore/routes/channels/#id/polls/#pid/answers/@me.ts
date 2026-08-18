/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.put("/", (req, res) => {
    res.status(403).send({
        message: "APIServer: Apps are not allowed to vote on polls.",
        code: 520000,
    });
});

export default app;
