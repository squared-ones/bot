/* Copyright Elysia © 2025. All rights reserved */

export interface Isku {
    id: string;
    name: string;
    interval: number;
    interval_count: number;
    tax_inclusive: boolean;
    sku_id: string;
    price: number;
    currency: Currency;
    price_tier: null;
    prices: { [key: string]: PriceValue };
}

export type Currency = "eur" | "usd" | "vnd";

export interface PriceValue {
    country_prices: CountryPrices;
    payment_source_prices: Record<string, PriceElement[]>;
}

export interface CountryPrices {
    country_code: CountryCode;
    prices: PriceElement[];
}

export type CountryCode = string; // ISO 3166-1 alpha-2 country code

export interface PriceElement {
    currency: Currency;
    amount: number;
    exponent: number;
}

export default {
    "978380684370378762": [
        {
            id: "978380692553465866",
            name: "Nitro Basic Monthly",
            interval: 1,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "978380684370378762",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "1024422698568122368",
            name: "Nitro Basic Yearly",
            interval: 2,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "978380684370378762",
            fallback_currency: "usd",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
    ],
    "521846918637420545": [
        {
            id: "511651876987469824",
            name: "Nitro Classic Yearly",
            interval: 2,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "521846918637420545",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "511651871736201216",
            name: "Nitro Classic Monthly",
            interval: 1,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "521846918637420545",
            fallback_currency: "usd",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
    ],
    "521847234246082599": [
        {
            id: "642251038925127690",
            name: "Nitro 3 Month",
            interval: 1,
            interval_count: 3,
            tax_inclusive: true,
            sku_id: "521847234246082599",
            currency: "usd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "511651880837840896",
            name: "Nitro Monthly",
            interval: 1,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "521847234246082599",
            fallback_price: 0,
            fallback_currency: "usd",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "511651885459963904",
            name: "Nitro Yearly",
            interval: 2,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "521847234246082599",
            fallback_price: 0,
            fallback_currency: "usd",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "944037208325619722",
            name: "Nitro 6 Month",
            interval: 1,
            interval_count: 6,
            tax_inclusive: true,
            sku_id: "521847234246082599",
            currency: "usd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                1: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
    ],
    "590663762298667008": [
        {
            id: "590665532894740483",
            name: "Server Boost Monthly",
            interval: 1,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "590663762298667008",
            discount_price: 0,
            fallback_price: 0,
            fallback_currency: "usd",
            fallback_discount_price: 0,
            fallback_discount_currency: "usd",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "590665538238152709",
            name: "Server Boost Yearly",
            interval: 2,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "590663762298667008",
            discount_price: 0,
            fallback_price: 0,
            fallback_currency: "usd",
            fallback_discount_price: 0,
            fallback_discount_currency: "usd",
            currency: "vnd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "vnd",
                                amount: 0,
                                exponent: 0,
                            },
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "944037355453415424",
            name: "Server Boost 3 Month",
            interval: 1,
            interval_count: 3,
            tax_inclusive: true,
            sku_id: "590663762298667008",
            currency: "usd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "944037391444738048",
            name: "Server Boost 6 Month",
            interval: 1,
            interval_count: 6,
            tax_inclusive: true,
            sku_id: "590663762298667008",
            discount_price: 0,
            currency: "usd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                6: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
    ],
    "521842865731534868": [
        {
            id: "511651860671627264",
            name: "Nitro Yearly (Legacy)",
            interval: 2,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "521842865731534868",
            currency: "usd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
        {
            id: "511651856145973248",
            name: "Nitro Monthly (Legacy)",
            interval: 1,
            interval_count: 1,
            tax_inclusive: true,
            sku_id: "521842865731534868",
            currency: "usd",
            price: 0,
            price_tier: null,
            prices: {
                0: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                3: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
                4: {
                    country_prices: {
                        country_code: "VN",
                        prices: [
                            {
                                currency: "usd",
                                amount: 0,
                                exponent: 0,
                            },
                        ],
                    },
                    payment_source_prices: {},
                },
            },
        },
    ],
} as Record<string, Isku[]>;
