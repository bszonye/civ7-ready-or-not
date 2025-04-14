// eslint.config.js
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        rules: {
            "no-unused-vars": [
                "warn",
                {
                    "varsIgnorePattern": "^_",
                    "argsIgnorePattern": "^_",
                }
            ]
        },
        languageOptions: {
            globals: {
                Cities: "readonly",
                Constructibles: "readonly",
                Controls: "readonly",
                CustomEvent: "readonly",
                Game: "readonly",
                GameContext: "readonly",
                GameInfo: "readonly",
                GameplayMap: "readonly",
                GrowthTypes: "readonly",
                IndependentRelationship: "readonly",
                Locale: "readonly",
                MapCities: "readonly",
                MapConstructibles: "readonly",
                MapUnits: "readonly",
                Players: "readonly",
                ReflectionArchives: "readonly",
                UI: "readonly",
                WorldAnchors: "readonly",
                YieldTypes: "readonly",
                console: "readonly",
                document: "readonly",
                engine: "readonly",
                localStorage: "readonly",
                window: "readonly",
            }
        }

    }
];
