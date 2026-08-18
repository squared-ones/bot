/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        referrals_remaining: 0,
        sent_user_ids: [],
        refresh_at: null,
        has_eligible_friends: true,
        recipient_status: {},
        is_eligible_for_incentive: false,
        is_qualified_for_incentive: false,
        referral_incentive_status: 0,
    });
});

export default app;
