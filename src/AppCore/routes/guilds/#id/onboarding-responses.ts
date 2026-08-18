/* Copyright Elysia © 2025. All rights reserved */

import { Request, Response, Router } from "express";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

const callback = (req: Request<{ id: string }>, res: Response) => {
    const BotToken = req.headers.authorization;
    const uid = Util.getIDFromToken(BotToken);
    const data = {
        ...req.body,
        guild_id: req.params.id,
        user_id: uid,
    };
    res.status(200).send(data);
};

app.post("/", (req, res) => {
    return Util.getDataFromRequest(req, res, callback);
});

app.put("/", (req, res) => {
    return Util.getDataFromRequest(req, res, callback);
});

export default app;
