/* Copyright Elysia © 2025. All rights reserved */

// Originally from Discord.js

import { ApplicationFlags } from "discord-api-types/v10";

import { BitField } from "./BitField";

/**
 * Data structure that makes it easy to interact with an {@link Application#flags} bitfield.
 * @extends {BitField}
 */
export class ApplicationFlagsBitField extends BitField {
    /**
     * Numeric application flags.
     *
     * @type {ApplicationFlags}
     * @memberof ApplicationFlagsBitField
     */
    static override Flags = ApplicationFlags;
}
/**
 * @name ApplicationFlagsBitField
 * @kind constructor
 * @memberof ApplicationFlagsBitField
 * @param {BitFieldResolvable} [bits=0] Bit(s) to read from
 */

/**
 * Bitfield of the packed bits
 *
 * @type {number}
 * @name ApplicationFlagsBitField#bitfield
 */

/**
 * Data that can be resolved to give an application flag bit field. This can be:
 * - A string (see {@link ApplicationFlagsBitField.Flags})
 * - An application flag
 * - An instance of ApplicationFlagsBitField
 * - An Array of ApplicationFlagsResolvable
 *
 * @typedef {string|number|ApplicationFlagsBitField|ApplicationFlagsResolvable[]} ApplicationFlagsResolvable
 */
