/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("*splat", (req, res) => {
    res.status(204).end();
});

export default app;
