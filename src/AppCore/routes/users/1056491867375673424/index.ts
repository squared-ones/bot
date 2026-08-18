/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";
import Constants from "src/AppCore/Constants";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send(Constants.UserDefaultPatch);
});

app.all("/*splat", (req, res) => {
    res.status(404).send();
});

export default app;
