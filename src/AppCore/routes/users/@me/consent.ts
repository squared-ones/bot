/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/", (req, res) => {
    res.send({
        personalization: {
            consented: false,
        },
        usage_statistics: {
            consented: false,
        },
    });
});

export default app;
