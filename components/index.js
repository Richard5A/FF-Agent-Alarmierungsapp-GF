// noinspection JSUnresolvedReference

import * as ApiService from "./ApiService.js";
import {debugLog} from "./ApiService.js";
import {PlaceRepository} from "./PlaceRepository"
import {MapService} from "./MapService.js";

function main() {

    const typFeld = document.getElementById('type');
    const ortFeld = document.getElementById('place');
    const beschreibungFeld = document.getElementById('description');
    const detailsFeld = document.getElementById('details');
    const leitungSchalter = document.getElementById('notifyLeader');
    const alarmButton = document.getElementById('triggerAlarm');
    const mapButton = document.getElementById('mapButton')
    const mapHomeButton = document.getElementById('mapHomeButton');
    const ortIcon = document.getElementById('placeIcon');
    const mapOrtIcon = document.getElementById('mapPlaceIcon');
    const overlay = document.getElementById('overlay');
    const peopleList = document.getElementById('peopleList');
    const alarmInfo = document.getElementById('alarminfo');
    const push = document.getElementById('push');
    const pushSelect = document.getElementById('pushSelect');
    const pushButton = document.getElementById('pushSend');
    const dropdown = document.getElementById('placeDropdown');
    const pushSpinner = document.getElementById('pushSpinner');
    const leaderLabel = document.getElementById('leaderLabel');
    const placeRepo = new PlaceRepository()

    // --- Map Service Initialisierung ---
    const mapService = new MapService('map', (selection) => {
        debugLog("[Map]", "Location selected from map:", selection);
        if (selection.source === 'manual') {
            if (placeRepo.findPlace(place?.name ?? "")) ortFeld.value = "";
            place = {name: ortFeld.value, lat: selection.lat, lng: selection.lng};
            mapOrtIcon.style.display = 'block';
            ortIcon.style.display = 'none';
        } else { // 'poi'
            place = placeRepo.findPlace(selection.name);
            ortFeld.value = selection.name
            mapOrtIcon.style.display = 'none';
            ortIcon.style.display = 'block';
        }
        checkForm();
    });
    try {
        mapService.initialize();
    } catch (e) {
        console.error("Map initialization failed:", e);
        mapButton.disabled = true;
    }

    let securityKey = new URLSearchParams(window.location.search).get("securitykey")
    let place = null
    let interval;
    let persons;
    let debug = window.env.DEBUG
    const keyword = debug ? "TEST" : "FR"
    const groupsGUIDS = window.env.GROUP_GUIDS
    const leader = window.env.LEADER_NAME

    function updateDropdown(filter = "") {
        if (document.getElementById('map').style.display !== 'none') return
        const allPlaces = placeRepo.getAllPlaceNames();
        debugLog("[Index]", "AllPlaces:", allPlaces)
        let filtered = allPlaces;
        if (filter.trim() !== "") {
            filtered = allPlaces.filter(place => place.name.toLowerCase().includes(filter.toLowerCase()));
        }
        dropdown.innerHTML = "";
        debugLog("[Index]", "FilteredPlaces:", filtered)
        if (filtered.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        filtered.forEach(place => {
            const li = document.createElement("li");
            li.textContent = place.name;
            li.style.padding = "8px";
            li.style.cursor = "pointer";
            li.addEventListener('mousedown', () => {
                debugLog("[Index]", 'Dropdown: Item clicked ->', place.name);
                ortFeld.value = place.name;
                dropdown.style.display = 'none';
                // Triggere das Input-Event manuell, um die Logik auszuführen
                ortFeld.dispatchEvent(new Event('input'));
            });
            dropdown.appendChild(li);
        });
        dropdown.style.display = 'block';
    }

// Zeige Dropdown, wenn das Feld fokussiert oder geändert wird
    ortFeld.addEventListener("focus", () => updateDropdown(ortFeld.value));
    ortFeld.addEventListener("input", () => updateDropdown(ortFeld.value));

// Blende Dropdown aus, wenn außerhalb geklickt wird
    document.addEventListener("mousedown", (e) => {
        if (!dropdown.contains(e.target) && e.target !== ortFeld) {
            dropdown.style.display = "none";
        }
    });

    ortFeld.addEventListener("focusout", () => {
        dropdown.style.display = "none";
    })

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            dropdown.style.display = "none";
        }
    })

    ortFeld.addEventListener("input", () => {
        place = placeRepo.findPlace(ortFeld.value); // place ist jetzt entweder das Objekt oder null

        if (place) {
            ortIcon.style.display = 'block';
            mapOrtIcon.style.display = 'none';
            mapService.selectPlaceByName(place.name);
        } else {
            ortIcon.style.display = 'none';
            if (ortFeld.value.trim().length === 0 || mapService.activePoiMarker) {
                mapService.resetSelection(); // Auswahl auf Karte zurücksetzen
                mapOrtIcon.style.display = 'none';
            }
        }
    })


    // Überprüfen, ob Ort und Typ ausgefüllt sind
    function checkForm() {
        alarmButton.disabled = !(ortFeld.value.trim() !== '' || place?.lat);
    }

    ortFeld.addEventListener('input', checkForm);
    typFeld.addEventListener('input', checkForm);
    checkForm();

    async function sendAlarm() {
        // Hier die Logik für die Alarmierung über die Web-API einfügen
        const placeDescription = place?.description ? ` || ${place.description}` : "";
        const fullDetails = detailsFeld.value + (detailsFeld.value && placeDescription ? placeDescription : placeDescription.substring(4));
        const data = {
            object: place?.asPrefix ? ortFeld.value : place?.name ?? ortFeld.value,
            type: typFeld.value,
            keyword: keyword + (leitungSchalter.selected && keyword !== "TEST" ? " + K" : ""),
            message: beschreibungFeld.value,
            details: fullDetails,
            lat: place?.lat ?? null,
            lng: place?.lng ?? null,

        };

        overlay.style.display = 'flex';

        try {
            const response = await ApiService.triggerAlarm(securityKey, data);
            if (response.ok) {
                resetUI();
            } else {
                alert('Fehler beim Auslösen des Alarms! Wechsel auf Backup!');
                await sendBackupAlarm(data);
            }
        } catch (error) {
            alert('Ein Netzwerkfehler ist beim Auslösen des Alarms aufgetreten!');
        }
    }

    async function sendBackupAlarm(data) {
        try {
            const response = await ApiService.triggerBackupAlarm(securityKey, data);
            if (response.ok) {
                resetUI();
                alert('Backup wurde erfolgreich ausgelöst!');
            }
        } catch (error) {
            alert('Fehler beim Auslösen des Backups!');
        }
    }

    async function handleSendPushMessage() {
        // UI blockieren und Spinner anzeigen
        push.disabled = true;
        pushSelect.disabled = true;
        pushButton.disabled = true;
        pushSpinner.style.display = 'flex';

        try {
            const response = await ApiService.sendPushMessage(securityKey, {
                groups: [pushSelect.value],
                message: push.value
            });
            if (response.ok) {
                resetPush();
                alert("Push erfolgreich gesendet");
            } else {
                alert("Fehler beim Senden der Push-Nachricht.");
            }
        } catch (err) {
            console.error("Fehler beim Senden der Push-Nachricht:", err);
            alert("Ein Netzwerkfehler ist aufgetreten.");
        } finally {
            // UI wieder freigeben und Spinner ausblenden
            push.disabled = false;
            pushSelect.disabled = false;
            pushButton.disabled = false;
            pushSpinner.style.display = 'none';
        }
    }

    function resetUI() {
        debugLog("[Index]", 'resetUI: Resetting UI after alarm.');
        typFeld.value = ""
        ortFeld.value = ""
        detailsFeld.value = ""
        beschreibungFeld.value = ""
        leitungSchalter.selected = false
        ortIcon.style.display = 'none'
        mapOrtIcon.style.display = 'none'
        place = null
        overlay.style.display = 'none';
        mapService.resetSelection();
        updateFFAgentData()
    }

    function resetPush() {
        pushSelect.selectedIndex = 0;
        push.value = "";
    }

    alarmButton.addEventListener("click", sendAlarm);
    pushButton.addEventListener("click", handleSendPushMessage)

    // --- Event-Listener für Map-Buttons ---
    mapButton.addEventListener("click", () => mapService.toggleVisibility(placeRepo.getAllPlaceNames()));
    mapHomeButton.addEventListener("click", () => mapService.resetView());

    const startInterval = () => {
        if (!interval) {
            updateFFAgentData();
            interval = setInterval(updateFFAgentData, 10000);
        }
    };

    const stopInterval = () => {
        clearInterval(interval);
        interval = null;
    };

    window.addEventListener("focus", startInterval);
    window.addEventListener("blur", stopInterval);
    window.addEventListener("load", startInterval);

    async function updateFFAgentData() {
        try {
            const {callRes, peopleRes} = await ApiService.fetchFFAgentData(securityKey);
            setAlarmInfo(callRes);
            setPeopleList(peopleRes);
        } catch (error) { /* Fehler wird bereits im ApiService geloggt */
        }
    }

    function setPeopleList(data) {
        debugLog("[Index]", 'setPeopleList: Updating people list.');
        peopleList.innerHTML = "";
        peopleList.style.padding = "0"
        if (!Object.keys(data).length) {
            peopleList.innerHTML = `<md-list-item><div>Liste leer</div></md-list-item>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        const headline = document.createElement("h2");
        debugLog("[Index]", "PeopleList:", data.persons?.available)
        headline.innerText = data.persons?.absent ? "Verfügbare Personen" : "Zusagen";
        fragment.appendChild(headline);

        if ("absent" in data.persons) {
            persons = Object.values([
                ...data.persons.available,
                ...data.persons.absent,
                ...data.persons.unavailable
            ])
        } else {
            persons = data.persons
        }
      
        persons.forEach(person => {
            const item = createPersonItem(person);
            fragment.appendChild(item);
        });

        peopleList.appendChild(fragment);
    }

    function createPersonItem(person) {
        const item = document.createElement("md-list-item");
        const mdIcon = document.createElement("md-icon");
        mdIcon.slot = "start";

        const statusMap = {
            "REQUESTED": {icon: "question_mark", class: "requested"},
            "ACCEPTED": {icon: "check", class: "accepted"},
            "REJECTED": {icon: "close", class: "rejected"}
        };

        const status = statusMap[person.status] || (person.available === false ? {class: "rejected"} :
            person.available === true && person.unavailableOrAbsenceDate !== null ? {class: "requested"} : {class: "accepted"});

        mdIcon.innerText = status.icon || "";
        item.classList.add(status.class);

        const chipSet = document.createElement("md-chip-set");
        chipSet.slot = "end";
        person?.skills?.forEach(skill => {
            const chip = document.createElement("md-assist-chip");
            chip.label = skill.shortTitle;
            chip.style.backgroundColor = skill.color;
            chip.style.pointerEvents = "none";
            chipSet.appendChild(chip);
        });

        item.innerHTML = `<div slot="headline">${person.name}</div>`;
        item.appendChild(chipSet);
        if (mdIcon.innerText !== "") item.appendChild(mdIcon);

        return item;
    }

    function setAlarmInfo(data) {
        debugLog("[Index]", 'setAlarmInfo: Updating alarm info.');
        alarmInfo.innerHTML = "";

        const title = document.createElement("h2");
        if (data?.mission) {
            const mission = data.mission;
            const [hh, mm] = mission.detail.alarmDate.split(":");
            alarmInfo.append(
                createElement("h2", "Einsatz aktiv:"),
                createElement("h3", `Start: ${hh}:${mm} Uhr`),
                createElement("h3", "Ort: " + (mission.detail.object?.split(" |")[0] || "Unbekannt")),
                createElement("h3", `Stichwort: ${mission.detail.type || "Unbekannt"}`),
                createElement("md-filled-button", "Einsatz beenden", {onclick: `window.open("${mission.finishUrl}", "popup", "width=800,height=600")`})
            );
        } else {
            title.innerText = "Kein Einsatz aktiv";
            alarmInfo.appendChild(title);
            // Das Zurücksetzen der Karte hier entfernt die manuelle Auswahl des Benutzers bei jedem Poll.
            // Das sollte nur passieren, wenn ein Einsatz *gerade eben* beendet wurde, nicht bei jedem Check.
            // mapManager.resetSelection(); // ENTFERNT
        }
    }

    function createElement(tag, text, attrs = {}) {
        const el = document.createElement(tag);
        if (text) el.innerText = text;
        Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
        return el;
    }

    function loadGroupGUIDS() {
        const elements = []

        groupsGUIDS.forEach((guid, index) => {
            const attributes = {value: guid.guid};
            if (index === 0) {
                attributes.selected = true;
            }
            elements.push(createElement("md-select-option", guid.name, attributes));
        })

        pushSelect.append(...elements)

    }

    loadGroupGUIDS()

    leaderLabel.innerText = `${leader} mit alarmieren`

}

document.addEventListener('DOMContentLoaded', main);
