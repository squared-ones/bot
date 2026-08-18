/* Copyright Elysia © 2025. All rights reserved */

import { Request, Response, Router } from "express";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

interface Params {
    id: string;
}
interface Body {
    thread_ids: string[];
}

app.post("/", (req, res) => {
    const callback = (
        reqCallback: Request<
            Params, // Params
            unknown, // ResBody
            Body, // ReqBody
            unknown // ReqQuery
        >,
        resCallback: Response,
    ) => {
        const threads: Record<
            string,
            {
                first_message: null;
                owner: null;
            }
        > = {};
        reqCallback.body?.thread_ids?.map(threadId => {
            threads[threadId] = {
                first_message: null,
                owner: null,
            };
        });
        return resCallback.send({
            threads,
        });
    };
    return Util.getDataFromRequest(req, res, callback);
});

export default app;
