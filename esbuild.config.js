// Lade Umgebungsvariablen aus der .env-Datei in process.env
require('dotenv').config();

const esbuild = require("esbuild");

const envVars = {
    // Lese die Variablen aus process.env. Fallbacks sind weiterhin eine gute Praxis.
    LEADER_NAME: process.env.LEADER_NAME ?? '',
    GROUP_GUIDS: process.env.GROUP_GUIDS_JSON ? JSON.parse(process.env.GROUP_GUIDS_JSON) : [],
    DEBUG: process.env.DEBUG === "true"
};

async function build() {
    try {
        console.log("Starting esbuild...");
        await esbuild.build({
            entryPoints: ["components/Material.js", "components/index.js", "components/index.css"],
            outdir: "components/dist",
            entryNames: '[name].min',
            bundle: true,
            minify: true,
            loader: {".css": "css"},
            define: {
                'window.env': JSON.stringify(envVars)
            }
        });
        console.log("Esbuild finished successfully!");
    } catch (e) {
        console.error("Esbuild failed:", e);
        process.exit(1);
    }
}

build();
