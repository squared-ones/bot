/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        country_code: "VN",
        subdivision_code: "SG",
    });
});

export default app;
