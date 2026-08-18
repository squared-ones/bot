/* Copyright Elysia © 2025. All rights reserved */

import { readFileSync } from "fs";
import { v3 } from "murmurhash";
import Constants from "src/AppCore/Constants";

const bucketReplacement = JSON.parse(readFileSync(Constants.DiscordUserExperimentsPath, "utf8")) as Record<
    string,
    TUserExperiment
>;

const apexExperiment = JSON.parse(readFileSync(Constants.DiscordApexExperimentsPath, "utf8")) as {
    evaluation_id: string;
    assignments: number[];
};

export interface TUserExperiment {
    revision: number;
    population: number;
    bucket: number;
    override: boolean;
    aaMode: boolean;
    triggerDebuggingEnabled: boolean;
    holdoutName: null | string;
    holdoutRevision: number | null;
    holdoutBucket: number | null;
}

const disabledBuckets = [
    "2023-03_pomelo_debounce_delay",
    "2023-04_pomelo_attempt",
    "2023-04_pomelo_suggestions",
    "2023-03_pomelo",
];

// id -> bucket
const forceEnabledBuckets: Record<string, number> = {
    // "2025-06_dave_for_browser": 2, // Enable
};

function buildUserExperiment (obj: Record<string, string>, botId: string) {
    const dataFromBucket = (bucketReplacement as Record<string, TUserExperiment>)[obj.id];
    if (!dataFromBucket) return null;
    if (disabledBuckets.includes(obj.id)) return null;
    const hash = v3(obj.id);
    const { revision } = dataFromBucket;
    let { bucket } = dataFromBucket;
    if (forceEnabledBuckets[obj.id] !== undefined) {
        bucket = forceEnabledBuckets[obj.id];
        dataFromBucket.override = true;
    }
    const override = dataFromBucket.override === false ? -1 : 0;
    const { population } = dataFromBucket;
    const hash_result = v3(`${obj.id}:${botId}`) % 10000;
    const aa_mode = Number(dataFromBucket.aaMode);
    const trigger_debugging = Number(dataFromBucket.triggerDebuggingEnabled);

    const arr: unknown[] = [hash, revision, bucket, override, population, hash_result, aa_mode, trigger_debugging];

    if (dataFromBucket.holdoutName) {
        arr.push(dataFromBucket.holdoutName);
        arr.push(dataFromBucket.holdoutRevision);
        arr.push(dataFromBucket.holdoutBucket);
    } else {
        arr.push(null, null, null);
    }

    return arr;
}

export function UserExperiment (allData: Record<string, string>[], botId: string) {
    return allData.map(obj => buildUserExperiment(obj, botId)).filter(x => x);
}

// Cache guild experiments to avoid reading file on every call
let cachedGuildExperiments: unknown = null;

export function GuildExperiment () {
    if (!cachedGuildExperiments) {
        cachedGuildExperiments = JSON.parse(readFileSync(Constants.DiscordGuildExperimentsPath, "utf8"));
    }
    return cachedGuildExperiments;
}

export function ApexExperiment (botId: string) {
    return {
        assignments: {
            "1": {
                [botId]: apexExperiment,
            },
        },
    };
}
