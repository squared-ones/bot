/* Copyright Elysia © 2025. All rights reserved */

import path from "path";
import UserPatch from "src/AppUtils/UserPatch";

const GithubUserName = "aiko-chan-ai";
const GithubRepoName = "DiscordBotClient";
// Assets live at the repo root; this file compiles to <root>/build/AppCore/.
const AssetsPath = path.join(__dirname, "..", "..", "assets");

export default class Constants extends null {
    static AppVersion = "3.9.3";
    static BlacklistRoutes = [
        "outbound-promotions/codes",
        "science",
        "applications/public",
        "notes",
        "member-ids",
        "connections/",
        "users/@me/disable",
        "users/@me/delete",
        "users/@me/mfa",
        "users/@me/phone",
        "interaction-data",
        "member-verification",
        "cdn-cgi/challenge-platform",
        "explicit-media",
        "premium/subscriptions",
        "/ack",
        "/stripe",
        "/paypal",
        "/validate-billing-address",
        "/custom-call-sounds",
        "auth/conditional/start", // Disable WebAuthn
    ];
    static LatestStorageUpdate = 1735000000000;
    static AppName = "DiscordBotClient";
    static AppID = "DiscordBotClient";
    static DiscordBackgroundColor = "#36393f";
    static GithubRepo = `${GithubUserName}/${GithubRepoName}`;
    static UserAgentDiscordBot = `DiscordBot (https://github.com/${GithubUserName}/${GithubRepoName}, v${Constants.AppVersion})`;
    static DiscordHTMLPath = path.join(AssetsPath, "snapshot", "index.html");
    static DiscordGuildExperimentsPath = path.join(AssetsPath, "snapshot", "guild_experiments.json");
    static DiscordUserExperimentsPath = path.join(AssetsPath, "snapshot", "user_experiments.json");
    static DiscordApexExperimentsPath = path.join(AssetsPath, "snapshot", "apex_experiments.json");
    static UserDefaultPatch = UserPatch["1056491867375673424"];
    static ChannelIdDefault = "1000000000000000000";
    static UserIdDefault = "1056491867375673424";
    static CustomDiscordDomain = "discord.com";
    static VerboseAPIServerLogging = false;
    // Database
    static DirectMessages = {
        name: "DMsData",
        path: "DirectMessages",
    };
    static PreloadedUserSettings = {
        name: "UserSettingsProto1",
        path: "PreloadedUserSettings",
    };
    static FrecencyUserSettings = {
        name: "UserSettingsProto2",
        path: "FrecencyUserSettings",
    };
    // Chromium Features
    static enableFeatures = [];
    static disableFeatures = [
        "CalculateNativeWinOcclusion",
        "OutOfBlinkCors",
        "WinRetrieveSuggestionsOnlyOnDemand",
        "HardwareMediaKeyHandling",
        "MediaSessionService",
    ];
}
