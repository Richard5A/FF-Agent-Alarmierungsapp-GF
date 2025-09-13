/**
 * Dieses Modul bündelt die gesamte Kommunikation mit der Backend-API.
 */

export function debugLog(origin, ...args) {
    if (window.env.DEBUG) {
        console.log('[DEBUG]', origin, ...args);
    }
}

/**
 * Löst den Hauptalarm aus.
 * @param {string} securityKey - Der Sicherheitsschlüssel für die API.
 * @param {object} alarmData - Die Daten für den Alarm.
 * @returns {Promise<Response>}
 */
export async function triggerAlarm(securityKey, alarmData) {
    debugLog("[ApiService]", 'triggerAlarm: Sending data ->', alarmData);
    return fetch(`/triggerAlarm?securitykey=${securityKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alarmData)
    });
}

/**
 * Löst einen Backup-Alarm aus (z.B. mit dem Keyword "TEST").
 * @param {string} securityKey - Der Sicherheitsschlüssel für die API.
 * @param {object} alarmData - Die Daten für den Alarm.
 * @returns {Promise<Response>}
 */
export async function triggerBackupAlarm(securityKey, alarmData) {
    const backupData = { ...alarmData, keyword: "TEST" };
    debugLog("[ApiService]", 'triggerBackupAlarm: Sending backup data ->', backupData);
    return fetch(`/triggerAlarm?securitykey=${securityKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupData)
    });
}

/**
 * Sendet eine Push-Nachricht.
 * @param {string} securityKey - Der Sicherheitsschlüssel für die API.
 * @param {object} pushData - Die Daten für die Push-Nachricht.
 * @returns {Promise<Response>}
 */
export async function sendPushMessage(securityKey, pushData) {
    debugLog("[ApiService]", 'sendPushMessage: Sending push data ->', pushData);
    return fetch(`/pushMessage?securitykey=${securityKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushData)
    });
}

/**
 * Ruft die aktuellen Einsatz- und Personendaten vom Server ab.
 * @param {string} securityKey - Der Sicherheitsschlüssel für die API.
 * @returns {Promise<{callRes: object, peopleRes: object}>}
 */
export async function fetchFFAgentData(securityKey) {
    debugLog("[ApiService]", 'fetchFFAgentData: Fetching new data...');
    try {
        const [callRes, peopleRes] = await Promise.all([
            fetch(`/call?securitykey=${securityKey}`, { method: "POST" }).then(r => r.json()),
            fetch(`/people?securitykey=${securityKey}`, { method: "POST" }).then(r => r.json())
        ]);
        debugLog("[ApiService]", 'fetchFFAgentData: Received data ->', { callRes, peopleRes });
        return { callRes, peopleRes };
    } catch (error) {
        console.error("Fehler beim Abrufen der Daten:", error);
        // Wir werfen den Fehler weiter, damit die aufrufende Funktion darauf reagieren kann.
        throw error;
    }
}