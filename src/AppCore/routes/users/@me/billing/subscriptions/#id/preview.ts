/* Copyright Elysia © 2025. All rights reserved */

import { DiscordSnowflake } from "@sapphire/snowflake";
import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/", (req, res) => {
    res.send({
        id: DiscordSnowflake.generate().toString(),
        invoice_items: [
            {
                id: DiscordSnowflake.generate().toString(),
                amount: 9999,
                discounts: [],
                subscription_plan_id: "511651885459963904",
                subscription_plan_price: 9999,
                quantity: 1,
                proration: false,
                tenant_metadata: {},
            },
        ],
        total: 9999,
        subtotal: 9999,
        currency: "usd",
        tax: 0,
        tax_inclusive: true,
        subscription_period_start: new Date().toISOString(),
        subscription_period_end: new Date(
            Date.now() + 31536000000, // 1 year
        ).toISOString(),
    });
});

export default app;
