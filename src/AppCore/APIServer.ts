/* Copyright Elysia © 2025. All rights reserved */

import express from "express";
import { readFileSync } from "fs";
import { request as httpsRequest } from "https";
import morgan from "morgan";
import path from "path";
import { registerRoutesSync } from "src/AppUtils/RegisterRoutes";
import Util from "src/AppUtils/Utils";

import Constants from "./Constants";

const logger = console;

// Discord's web client is built for user accounts. When signed in with a bot
// token, the gateway READY payload omits user-only fields, which crashes the
// client's READY telemetry and loops socket resets. The injected WebSocket
// wrapper (see serveDiscordHTML) patches READY to fill those fields in, but it
// only works when the client uses the pass-through "plaintext" gateway
// adapter — forced here by rewriting the pinned web bundle. If a future
// Discord build moves the marker, the upstream file is served unchanged.
const PLAINTEXT_FLAG_FROM = "isDiscordGatewayPlaintextSet(){return!1}";
const PLAINTEXT_FLAG_TO = "isDiscordGatewayPlaintextSet(){return!0}";
const patchedBundles = new Map<string, string>();

function fetchPatchedWebBundle (assetPath: string): Promise<string> {
    const cached = patchedBundles.get(assetPath);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
        const target = `https://canary.discord.com${assetPath}`;
        const proxyReq = httpsRequest(
            target,
            {
                method: "GET",
                headers: {
                    // Fetch uncompressed so the body can be rewritten in place.
                    "Accept-Encoding": "identity",
                    "User-Agent": Constants.UserAgentDiscordBot,
                },
            },
            proxyRes => {
                if (proxyRes.statusCode !== 200) {
                    proxyRes.resume();
                    return reject(new Error(`web bundle fetch failed: ${proxyRes.statusCode}`));
                }
                const chunks: Buffer[] = [];
                proxyRes.on("data", chunk => chunks.push(chunk));
                proxyRes.on("end", () => {
                    let body = Buffer.concat(chunks).toString("utf8");
                    if (body.includes(PLAINTEXT_FLAG_FROM)) {
                        body = body.split(PLAINTEXT_FLAG_FROM).join(PLAINTEXT_FLAG_TO);
                    } else {
                        logger.warn(
                            "[DiscordBotClient] web bundle patch marker not found — plaintext gateway not forced; bot-token READY may still crash.",
                        );
                    }
                    patchedBundles.set(assetPath, body);
                    resolve(body);
                });
            },
        );
        proxyReq.on("error", reject);
        proxyReq.end();
    });
}

const app = express();

// When DISCORD_TOKEN is set, the /client web app is pre-authenticated with the
// Squared One bot token so the Discord login page is skipped entirely. The
// Discord web client reads its token from `JSON.parse(localStorage.token)`,
// so the value is stored JSON-encoded.
const AUTO_LOGIN_TOKEN = process.env.DISCORD_TOKEN || "";

// The web client sends a user-style identify (no `intents` field), which
// Discord rejects for bot tokens with close code 4013 ("Invalid intent(s)").
// Inject the bot's intents into the identify (op 2) payload. Defaults to the
// intents Squared One's bot declares (Guilds|GuildMembers|GuildVoiceStates|
// GuildMessages = 531); override with CLIENT_INTENTS if more are enabled.
const CLIENT_INTENTS = Number(process.env.CLIENT_INTENTS) || 531;

function serveDiscordHTML(res: express.Response) {
    let html = readFileSync(Constants.DiscordHTMLPath, "utf8");
    if (AUTO_LOGIN_TOKEN) {
        // JSON.stringify twice: once for the stored JSON value, once to embed it
        // as a JS string literal inside the injected <script>.
        const tokenLiteral = JSON.stringify(JSON.stringify(AUTO_LOGIN_TOKEN));
        // The WebSocket wrapper has three jobs:
        //  1. Rewrite outgoing identify (op 2) payloads to carry the bot's
        //     intents — Discord rejects user-style identifies for bot tokens.
        //  2. Drop the compress= gateway param — the web bundle is rewritten
        //     to force the pass-through plaintext adapter, so gateway
        //     messages arrive as plain JSON.
        //  3. Patch incoming READY payloads with the user-only fields the web
        //     client expects, so bot-token sessions don't crash its READY
        //     telemetry and loop socket resets.
        const injection =
            `<script>try{var t=localStorage.getItem("token");if(!t){localStorage.setItem("token",${tokenLiteral});}}catch(e){}</script>` +
            `<script>try{(function(){var I=${CLIENT_INTENTS};` +
            // User-only READY fields bot tokens never receive. Only filled in
            // when missing, so bot fields (guilds, user, session_id, ...)
            // are preserved.
            `var D={users:[],sessions:[],guild_join_requests:[],relationships:[],connected_accounts:[],private_channels:[],merged_presences:{friends:[],guilds:[]},merged_members:[],presences:[],experiments:[],guild_experiments:[],read_state:{entries:[],version:0,partial:false},user_guild_settings:{partial:false,entries:[],version:0},notification_settings:{flags:0},consents:{},auth_session_id_hash:"",static_client_session_id:"",analytics_token:"",friend_suggestion_count:0,tutorial:null,geo_ordered_rtc_regions:[],counts:{},games:{},user_settings:{}};` +
            `var W=window.WebSocket;if(!W)return;` +
            `function patchReady(d){for(var k in D){if(d[k]===void 0){d[k]=D[k];}}return d;}` +
            `function patchMessage(ev){try{var data=ev&&ev.data;if(typeof data==="string"){var m=JSON.parse(data);if(m&&m.t==="READY"&&m.d&&typeof m.d==="object"){patchReady(m.d);return new MessageEvent("message",{data:JSON.stringify(m)});}}}catch(e){}return ev;}` +
            `function plainUrl(u){try{var url=new URL(u);url.searchParams.delete("compress");return url.toString();}catch(e){return u;}}` +
            `function P(u,p){var s=p?new W(plainUrl(u),p):new W(plainUrl(u));` +
            `var g=s.send.bind(s);` +
            `s.send=function(d){if(typeof d==="string"){try{var m=JSON.parse(d);if(m&&m.op===2&&m.d){if(typeof m.d.intents==="undefined"){m.d.intents=I;d=JSON.stringify(m);}}}catch(e){}}return g(d);};` +
            `var add=s.addEventListener?s.addEventListener.bind(s):null;` +
            `if(add){s.addEventListener=function(type,fn,opts){if(type==="message"){var h=fn;fn=function(ev){return h.call(this,patchMessage(ev));};}return add(type,fn,opts);};}` +
            `var om=null;` +
            `try{Object.defineProperty(s,"onmessage",{get:function(){return om;},set:function(fn){om=fn?function(ev){return fn.call(this,patchMessage(ev));}:null;},configurable:true});}catch(e){}` +
            `return s;}` +
            `P.prototype=W.prototype;P.CONNECTING=W.CONNECTING;P.OPEN=W.OPEN;P.CLOSING=W.CLOSING;P.CLOSED=W.CLOSED;` +
            `window.WebSocket=P;` +
            `})();}catch(e){}</script>`;
        html = html.replace("<head>", `<head>${injection}`);
    }
    res.send(html);
}

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

// Rewrites the pinned Discord web bundle to force the pass-through plaintext
// gateway adapter (see PLAINTEXT_FLAG_* above), so the injected WebSocket
// wrapper can patch bot-token READY payloads.
app.get(/^\/assets\/web\..+\.js$/, async (req, res, next) => {
    try {
        const body = await fetchPatchedWebBundle(req.path);
        res.set("Content-Type", "application/javascript; charset=utf-8");
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        res.send(body);
    } catch (error) {
        logger.warn(
            "[DiscordBotClient] failed to fetch/rewrite web bundle, serving upstream:",
            (error as Error).message,
        );
        next();
    }
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
        // The login page is removed: with auto-login enabled, send users
        // straight into the app instead of showing Discord's login UI.
        if (AUTO_LOGIN_TOKEN && req.path === "/login") return res.redirect("/channels/@me");
        logger.log("Serving Discord HTML for route:", req.path);
        return serveDiscordHTML(res);
    }
    // Other routes
    req.headers = req.originalHeaders;
    return Util.proxy(req, res);
});

export default app;
