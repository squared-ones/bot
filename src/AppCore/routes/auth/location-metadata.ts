/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        consent_required: false,
        country_code: "VN",
        promotional_email_opt_in: {
            required: true,
            pre_checked: false,
        },
    });
});

export default app;
