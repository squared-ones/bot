/* Copyright Elysia © 2025. All rights reserved */

import express from "express";
import { readFileSync } from "fs";
import morgan from "morgan";
import path from "path";
import { registerRoutesSync } from "src/AppUtils/RegisterRoutes";
import Util from "src/AppUtils/Utils";

import Constants from "./Constants";

const logger = console;

const app = express();

if (Constants.VerboseAPIServerLogging) {
    app.use(
        morgan("dev", {
            stream: {
                write: msg => logger.info(msg.replace(/\n/g, "")),
            },
        }),
    );
}

const ignoreHeaders = ["cookie", "sec-", "referer", "origin", "authorization", "host"];

// Handle headers
app.use(function (req, res, next) {
    req.originalHeaders = req.headers;
    const headers: typeof req.headers = {};
    Object.keys(req.headers).forEach(key => {
        if (!ignoreHeaders.some(prefix => key.toLowerCase().startsWith(prefix))) {
            headers[key] = req.headers[key];
        }
    });
    if (req.headers.authorization) {
        if (!req.headers.authorization.toLowerCase().startsWith("bot ")) {
            headers.authorization = `Bot ${req.headers.authorization.trim()}`;
        } else {
            headers.authorization = req.headers.authorization.trim();
        }
        headers["user-agent"] = Constants.UserAgentDiscordBot;
    }
    req.headers = headers;
    next();
});

registerRoutesSync(app, path.resolve(__dirname, "routes"), ["/api/v10", "/api/v9", "/api"]);

app.all("/developers/*splat", (req, res) => {
    return res.redirect("/app");
});

// Other
app.use((req, res, next) => {
    if (req.originalUrl.endsWith(".map")) return res.status(404).send();
    if (Constants.BlacklistRoutes.some(_ => req.originalUrl.includes(_))) {
        return res.status(403).send({
            message: "APIServer: Bots cannot use this endpoint",
            code: 20001,
        });
    }
    // API routes
    if (req.originalUrl.includes("/api/")) return Util.proxy(req, res);
    // Main page
    if (["/", "/app", "/login", "/client"].includes(req.path) || ["/channels/"].some(s => req.path.startsWith(s))) {
        logger.log("Serving Discord HTML for route:", req.path);
        return res.send(readFileSync(Constants.DiscordHTMLPath, "utf8"));
    }
    // Other routes
    req.headers = req.originalHeaders;
    return Util.proxy(req, res);
});

export default app;
