/* Copyright Elysia © 2025. All rights reserved */

import fs from "fs";
import { parse, stringify } from "ini";
import path from "path";

/**
 * @typedef {Object} Config
 * @property {boolean} cache_assets - Whether to cache assets from `discord.com/assets`.
  This can improve performance in environments with unstable or slow network connections.
 * @property {number} guilds_per_shard - Number of guilds per shard.
 * @property {boolean} suppress_intent_warning - Suppress intent warning.
 * @property {boolean} generate_fake_profile - Generate a fake profile for the user.
 */

export type Config = {
    cache_assets: boolean;
    guilds_per_shard: number;
    suppress_intent_warning: boolean;
    generate_fake_profile: boolean;
};

export class GlobalConfig {
    /**
     * Get the current configuration.
     * @returns {Config} The current configuration object.
     */
    config = this.defaultConfig();
    iniPath = path.join(__dirname, "..", "..", "data", "discordbotclient.ini");
    constructor () {
        if (!fs.existsSync(this.iniPath)) {
            console.log("Config file not found, creating default config:", this.iniPath);
            fs.mkdirSync(path.dirname(this.iniPath), { recursive: true });
            fs.writeFileSync(this.iniPath, this.toString(), "utf-8");
        } else {
            console.log("Loading configuration from", this.iniPath);
            this.loadConfig(fs.readFileSync(this.iniPath, "utf-8"));
        }
    }
    loadConfig (iniString: string) {
        if (typeof iniString !== "string") {
            throw new Error("Invalid configuration string provided.");
        }
        const oldData = JSON.parse(JSON.stringify(this.config));
        try {
            Object.assign(this.config, parse(iniString));
            this.validateConfig();
        } catch (e) {
            console.error("Failed to parse configuration, reverting to old config", oldData);
            this.config = oldData;
            throw e;
        }
    }
    /**
     * @returns {Config} The default configuration object.
     */
    defaultConfig () {
        return {
            cache_assets: false,
            guilds_per_shard: 100,
            suppress_intent_warning: false,
            generate_fake_profile: true,
        };
    }
    /**
     * Validate the current configuration.
     */
    validateConfig () {
        for (const key in this.config) {
            if (!Object.prototype.hasOwnProperty.call(this.defaultConfig(), key)) {
                console.warn(`Unknown configuration key "${key}" found, removing it.`);
                // @ts-expect-error ???
                delete this.config[key];
            } else {
                // @ts-expect-error ???
                this.config[key] = this.parseIniValue(this.config[key]);
            }
        }
        if (typeof this.config.cache_assets !== "boolean") {
            throw new Error("Invalid value for cache_assets, expected boolean.");
        }
        if (typeof this.config.guilds_per_shard !== "number" || this.config.guilds_per_shard <= 0) {
            throw new Error("Invalid value for guilds_per_shard, expected positive number.");
        }
        if (typeof this.config.suppress_intent_warning !== "boolean") {
            throw new Error("Invalid value for suppress_intent_warning, expected boolean.");
        }
        if (typeof this.config.generate_fake_profile !== "boolean") {
            throw new Error("Invalid value for generate_fake_profile, expected boolean.");
        }
    }
    // eslint-disable-next-line
    parseIniValue(val: any) {
        if (typeof val !== "string") return val;
        if (/^(true|false)$/i.test(val)) return val.toLowerCase() === "true";
        if (!isNaN(Number(val)) && val.trim() !== "") return Number(val);
        return val;
    }
    /**
     * Get the INI formatted string of the current configuration.
     * @returns {string} The INI formatted string.
     */
    toString () {
        this.validateConfig();
        return stringify(this.config, {
            align: true,
        });
    }
    save () {
        fs.writeFileSync(this.iniPath, this.toString(), "utf-8");
    }
    monacoAutoComplete () {
        return {
            cache_assets: {
                documentation: `Determines whether asset files from \`discord.com/assets\` should be stored on local storage.

Enabling this option can improve page load speed in environments with unstable or slow network connections, since frequently used assets will be loaded directly from disk.

**Note:**  
This feature is **not recommended** for most users. Old asset files are not automatically deleted and can only be fully removed by reinstalling the application.

**Type:** \`boolean\`  
**Default:** \`false\``,
                enum: {
                    true: {
                        documentation: "Enable asset caching.",
                    },
                    false: {
                        documentation: "Disable asset caching (default).",
                    },
                },
            },
            guilds_per_shard: {
                documentation: `Defines the maximum number of guilds (Discord servers) that can be handled by a single session (shard) of the application.

This value helps the application calculate the required number of shards. Due to Discord's internal sharding algorithm, the actual number of guilds assigned to each shard may vary and will not always be perfectly distributed.

Setting this to a very large number may cause unexpected or unstable behavior.

**Type:** \`number\`  
**Default:** \`100\``,
            },
            suppress_intent_warning: {
                documentation: `Specifies whether the application should refuse to log in if the required Privileged Intents (\`MESSAGE_CONTENT\`) are not granted to your bot by Discord.

**Warning:**  
Disabling this option is not recommended unless you fully understand the consequences.

**Type:** \`boolean\`  
**Default:** \`true\``,
                enum: {
                    true: {
                        documentation:
                            "The application will abort startup and warn you if MESSAGE_CONTENT is missing, improving stability and predictability. (default)",
                    },
                    false: {
                        documentation:
                            "The application will attempt to continue running even without all the recommended intents, but this may result in unexpected or unstable behavior.",
                    },
                },
            },
            generate_fake_profile: {
                documentation: `Determines whether to use fake data to enhance (beautify) the user's profile by patching the \`/users/:id/profile\` API response.

When enabled (default), fake or enhanced profile data will be injected, making user profiles appear more polished.

Disabling this option still patches some necessary API fields (to prevent crashes), but does not add additional fake data.

**Type:** \`boolean\`
**Default:** \`true\``,
                enum: {
                    true: {
                        documentation: "Enable fake profile data injection (default).",
                    },
                    false: {
                        documentation: "Disable fake profile data injection, using only real data from Discord.",
                    },
                },
            },
        };
    }
}

export default new GlobalConfig();
