Die Web-UI für die einfache Alarmierung über FF-Agent.

Design: MD3 von Google.

Features:
- Alarm auslösen
- Stati von Personen sehen (wird alle 15s neu angefragt)
- Erkennen von bestimmten vordefinierten Räumen oder Orten -> automatische Koordinatenangabe
- eigenes Logsystem, dass die Logs in eigener Datei speichert

Installation:
-

Deployment Variablen einrichten:
- DEBUG Flag: bestimmt ob debugs in Console und Browser ausgegeben wird & ob das Stichwort Test ist (true/false)
- WEBPASSWORD: Password, um auf die WebUI zuzugreifen
- CERTPSWD: Password für FF-Agent Client Zertifikat
- WEBAPITOKEN: Siehe FF-Agent Web-Api Doku
- WEBAPIKEY: Siehe FF-Agent Web-Api Doku
- SELECTIVECALLCODE: Siehe FF-Agent Web-Api Doku
- ACCESSTOKEN: Siehe FF-Agent Web-Api Doku
- PRIVATEAUTHKEY: GUID für die Authentifizierung von der Web-UI
- ORGANSIATIONTOKEN: Aus Anfrage vom Statusmonitor
- DISPLAYTOKEN: Aus Anfrage vom Statusmonitor

Launching:
Vercel ready
self-hosting (untested)

