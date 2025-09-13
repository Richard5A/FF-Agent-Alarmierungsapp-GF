// noinspection JSUnresolvedReference

const express = require("express");
const CryptoJS = require("crypto-js");
const path = require("path");
const app = express();
const fs = require('fs');
const https = require('https');
const forge = require('node-forge');

// --- Configuration Loading ---
const config = {
    CERT_PASSWORD: process.env.CERT_PASSWORD,
    PRIVATE_AUTH_KEY: process.env.PRIVATE_AUTH_KEY,
    DEBUG: process.env.DEBUG === "true",
    WEB_PASSWORD: process.env.WEB_PASSWORD,
    DISPLAY_TOKEN: process.env.DISPLAY_TOKEN,
    ORGANISATION_TOKEN: process.env.ORGANISATION_TOKEN,
    WEB_API_TOKEN: process.env.WEB_API_TOKEN,
    SELECTIVE_CALL_CODE: process.env.SELECTIVE_CALL_CODE,
    ACCESS_TOKEN: process.env.ACCESS_TOKEN,
    WEB_API_KEY: process.env.WEB_API_KEY,
};

// Validate essential configuration
const requiredConfig = [
    'CERT_PASSWORD',
    'PRIVATE_AUTH_KEY',
    'WEB_PASSWORD',
    'DISPLAY_TOKEN',
    'ORGANISATION_TOKEN',
    'WEB_API_TOKEN',
    'SELECTIVE_CALL_CODE',
    'ACCESS_TOKEN',
    'WEB_API_KEY'
];
for (const key of requiredConfig) {
    if (!config[key]) {
        throw Error(`Configuration error: Environment variable for '${key}' is missing.`);
    }
}

// Asynchronously import node-fetch once at startup
const fetchPromise = import('node-fetch').then(module => module.default);

const p12Path = path.join(__dirname, '..', 'keycert.p12');
const p12Buffer = fs.readFileSync(p12Path);
const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, true, config.CERT_PASSWORD);

const keyObj = p12.getBags({bagType: forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag][0];
const certObj = p12.getBags({bagType: forge.pki.oids.certBag})[forge.pki.oids.certBag][0];

const privateKey = forge.pki.privateKeyToPem(keyObj.key);
const certificate = forge.pki.certificateToPem(certObj.cert);

const agent = new https.Agent({
    cert: certificate,
    key: privateKey,
    passphrase: config.CERT_PASSWORD,
});

app.use(express.json());

/**
 * Sends a request to the FF-Agent WebService API (triggerAlarm or pushMessage).
 * Handles HMAC generation and the actual fetch call.
 * @param {'triggerAlarm' | 'pushMessage'} endpoint The API endpoint to call.
 * @param {object} req The JSON payload for the request.
 * @param res
 * @returns {Promise<void>}
 */
async function sendFfAgentRequest(endpoint, req, res) {
    const securityKey = req.query.securitykey;

    if (config.DEBUG) {
        console.log("Received securityKey:", securityKey);
    }

    if (securityKey !== config.PRIVATE_AUTH_KEY) {
        res.status(401)
            .sendFile(path.join(__dirname, "..", "components", "failed.html"));
        return;
    }

    const dataString = JSON.stringify(req.body);

    if (config.DEBUG) {
        console.log(`[${endpoint}] Incoming Request Data:`, dataString);
    }

    try {
        const fetch = await fetchPromise;
        let message, headers;

        if (endpoint === 'triggerAlarm') {
            message = `${config.WEB_API_TOKEN}${config.SELECTIVE_CALL_CODE}${config.ACCESS_TOKEN}${dataString}`;
            headers = {
                "webApiToken": config.WEB_API_TOKEN,
                "selectiveCallCode": config.SELECTIVE_CALL_CODE,
                "accessToken": config.ACCESS_TOKEN
            };
        } else { // pushMessage
            message = `${config.WEB_API_TOKEN}${dataString}`;
            headers = { "webApiToken": config.WEB_API_TOKEN };
        }

        const hmac = CryptoJS.HmacSHA256(message, config.WEB_API_KEY);
        const hashInHex = CryptoJS.enc.Hex.stringify(hmac);

        headers["Content-Type"] = "application/json";
        headers["hmac"] = hashInHex;

        if (config.DEBUG) {
            console.log(`[${endpoint}] Generated message:`, message);
            console.log(`[${endpoint}] Generated HMAC:`, hashInHex);
        }

        const response = await fetch(`https://api.service.ff-agent.com/v1/WebService/${endpoint}`, {
            method: "POST",
            agent: agent,
            headers: headers,
            body: dataString
        });

        if (response.ok) {
            const successMessage = endpoint === 'triggerAlarm' ? 'Alarm was successfully triggered!' : 'Push was successfully sent!';
            res.status(200).send(successMessage);
        } else {
            res.status(response.status).send(`Error during ${endpoint}.`);
        }
    } catch (error) {
        res.status(500).send(`Internal server error during ${endpoint}.`);
    }
}

app.post(`/triggerAlarm`, (req, res) => {
    sendFfAgentRequest('triggerAlarm', req, res);
});

app.post(`/pushMessage`, (req, res) => {
    sendFfAgentRequest('pushMessage', req, res);
});

// --- FF-Agent WidgetViewApi Data Fetching ---

async function fetchWidgetData(endpoint, body = {}) {
    const fetch = await fetchPromise;
    const url = `https://www.ff-agent.com/status-monitor-v2/WidgetViewApi/ajax_data/${endpoint}?displayToken=${config.DISPLAY_TOKEN}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            "cookie": `organisationToken=${config.ORGANISATION_TOKEN}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FF-Agent API error for ${endpoint}: ${response.status} - ${errorText}`);
    }
    return response.json();
}

const getCall = () => fetchWidgetData('ACTIVE_MISSION_INFO');

const getPeopleWhenCall = () => fetchWidgetData('TEAM_STATUS', {
    includeSkills: true,
    showPersonsRequested: true,
    showPersonsAccepted: true,
    showPersonsRejected: true,
});

const getPeopleWhenNoCall = () => fetchWidgetData('PERSONS_AVAILABILITY', {
    individualPersons: true,
    includeSummary: true,
});

async function getPeople() {
    const callData = await getCall();
    // If there is no error field, a call is active
    if (!callData?.error) {
        return getPeopleWhenCall();
    } else {
        return getPeopleWhenNoCall();
    }
}

app.get('/', (req, res) => {
    const securityKey = req.query.securitykey;

    if (config.DEBUG) {
        console.log("Received securityKey:", securityKey);
    }

    if (securityKey !== config.PRIVATE_AUTH_KEY) {
        res.status(401)
            .sendFile(path.join(__dirname, "..", "components", "failed.html"));
    } else {
        res.status(200).sendFile(path.join(__dirname, "..", "components", "index.html"));
    }
});

app.get(`/index.js`, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, "..", "components", "dist", "index.min.js"));
});

app.get(`/logo.png`, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, "..", "assets", "logo.png"));
});

app.get(`/index.css`, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, "..", "components", "dist", "index.min.css"));
});

app.get(`/material.js`, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, "..", "components", "dist", "Material.min.js"));
});

app.post("/passwordcheck", (req, res) => {
    const data = req.body;
    if (data.psw === config.WEB_PASSWORD) {
        res.json({ redirectUrl: `/?securitykey=${config.PRIVATE_AUTH_KEY}`})
    } else {
        res.status(403).send('Unauthorized')
    }
})

app.post("/people", async (req, res) => {
    const securityKey = req.query.securitykey;
    if (securityKey !== config.PRIVATE_AUTH_KEY) {
        return res.status(403).send("Forbidden");
    }
    try {
        const data = await getPeople();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch people data." });
    }
});

app.post("/call", async (req, res) => {
    const securityKey = req.query.securitykey;
    if (securityKey !== config.PRIVATE_AUTH_KEY) {
        return res.status(403).send("Forbidden");
    }
    try {
        const data = await getCall();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch call data." });
    }
});

module.exports = app;
