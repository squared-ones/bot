/* Copyright Elysia © 2025. All rights reserved */

import { APIUser } from "discord-api-types/v10";
import { Request, Response, Router } from "express";
import Constants from "src/AppCore/Constants";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

export interface ModifyCurrentUserProfile {
    /**
     * The user's pronouns (max 40 characters)
     */
    pronouns?: string | null;
    /**
     * The user's bio (max 190 characters)
     */
    bio?: string | null;
    /**
     * The user's banner; can only be changed for premium users
     */
    banner?: string | null;
    /**
     * The user's banner color encoded as an integer representation of a hexadecimal color code
     */
    accent_color?: number | null;
    /**
     * The user's two theme colors encoded as an array of integers representing hexadecimal color codes; can only be changed for premium users
     */
    theme_colors?: [number, number];
    /**
     * The user's profile popout animation particle type; can only be changed for premium users
     */
    popout_animation_particle_type?: string | null;
    /**
     * The user's profile emoji ID; can only be changed for premium users
     */
    emoji_id?: string | null;
    /**
     * The user's profile effect ID; can only be changed for premium users
     */
    profile_effect_id?: string | null;
}

export const callbackEditCurrentUser = (
    reqCallback: Request<
        {
            id: string;
        },
        unknown,
        ModifyCurrentUserProfile
    >,
    resCallback: Response,
) => {
    const body: Record<string, unknown> = {};
    if ("banner" in reqCallback.body) body.banner = reqCallback.body.banner;
    fetch("https://canary.discord.com/api/v10/users/@me", {
        headers: {
            authorization: reqCallback.headers.authorization,
            "user-agent": Constants.UserAgentDiscordBot,
            "Content-Type": "application/json",
        } as Record<string, string>,
        method: "PATCH",
        body: JSON.stringify(body),
    })
        .then(r => r.json() as Promise<APIUser>)
        .then(d => {
            return resCallback.send({
                guild_id: null,
                pronouns: "",
                bio: null,
                banner: d.banner,
                accent_color: null,
                theme_colors: null,
                popout_animation_particle_type: null,
                emoji: null,
                profile_effect: null,
            });
        })
        .catch(err => {
            console.error("Error in /users/@me/profile PATCH (user):", err);
            if (!resCallback.headersSent) resCallback.status(500).send({ message: "Internal Server Error", code: 500 });
        });
};

app.patch("/", async (req, res) => {
    return Util.getDataFromRequest(req, res, callbackEditCurrentUser);
});

export default app;
