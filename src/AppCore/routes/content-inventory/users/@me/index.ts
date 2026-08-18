/* Copyright Elysia © 2025. All rights reserved */

import crypto from "node:crypto";

import { Router } from "express";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    const randomData = crypto.randomBytes(16);
    res.send({
        request_id: crypto.createHash("md5").update(randomData).digest("hex"),
        entries: [],
        entries_hash: 0,
        expired_at: Util.makeISODate(10),
        refresh_stale_inbox_after_ms: 3_000_000,
        refresh_token: Buffer.from(
            JSON.stringify({
                created_at: Util.makeISODate(),
                content_hash: crypto.createHash("sha256").update(randomData).digest("base64"),
            }),
            "utf-8",
        ).toString("base64"),
        wait_ms_until_next_fetch: 3_000_000,
    });
});

export default app;
