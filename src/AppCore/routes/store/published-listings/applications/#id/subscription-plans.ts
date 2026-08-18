/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send([
        {
            id: "",
            name: "",
            interval: 1,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "",
            fallback_price: 499,
            fallback_currency: "eur",
            currency: "eur",
            price: 4199,
            price_tier: null,
        },
    ]);
});

export default app;
