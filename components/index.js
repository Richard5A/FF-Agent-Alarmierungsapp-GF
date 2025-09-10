// noinspection JSUnresolvedReference

import {PlaceRepository} from "./PlaceRepository"

function main() {

    const typFeld = document.getElementById('type');
    const ortFeld = document.getElementById('place');
    const beschreibungFeld = document.getElementById('description');
    const detailsFeld = document.getElementById('details');
    const leitungSchalter = document.getElementById('notifyLeader');
    const alarmButton = document.getElementById('triggerAlarm');
    const ortIcon = document.getElementById('placeIcon');
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
    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
    let securityKey = params.securitykey;
    let place = null
    let interval;
    let persons;
    let debug = window.env.DEBUG
    let keyword = debug ? "TEST" : "FR"
    const groupsGUIDS = window.env.GROUP_GUIDS
    const leader = window.env.LEADER_NAME

    function updateDropdown(filter = "") {
        const allPlaces = placeRepo.getAllPlaceNames();
        console.log(allPlaces)
        let filtered = allPlaces;
        if (filter.trim() !== "") {
            filtered = allPlaces.filter(place => place.name.toLowerCase().includes(filter.toLowerCase()));
        }
        dropdown.innerHTML = "";
        console.log(filtered)
        if (filtered.length === 0) {
            dropdown.style.display = "none";
            return;
        }
        filtered.forEach(place => {
            const li = document.createElement("li");
            li.textContent = place.name;
            li.style.padding = "8px";
            li.style.cursor = "pointer";
            li.addEventListener("mousedown", () => {
                ortFeld.value = place.name;
                dropdown.style.display = "none";
                ortFeld.dispatchEvent(new Event("input"));
            });
            dropdown.appendChild(li);
        });
        dropdown.style.display = "block";
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
        place = placeRepo.findPlace(ortFeld.value)
        if (place !== null || undefined) {
            ortIcon.style.display = 'block'
        } else {
            ortIcon.style.display = 'none'
        }
    })


    // Überprüfen, ob Ort und Typ ausgefüllt sind
    function checkForm() {
        alarmButton.disabled = !(ortFeld.value.trim() !== '');
    }

    ortFeld.addEventListener('input', checkForm);
    typFeld.addEventListener('input', checkForm);
    checkForm();

    function sendAlarm() {
        // Hier die Logik für die Alarmierung über die Web-API einfügen
        const inputDetails = detailsFeld.value.length !== 0 ? (" || " + place?.description) : place?.description
        const fullPlaceDesc = place !== null || place?.description !== undefined ? inputDetails : ""
        const data = {
            object: place === null ? ortFeld.value : ("aliases" in place && place.aliases.find(alias => alias === ortFeld.value) === null ? place.name : ortFeld.value),
            type: typFeld.value,
            keyword: keyword + (leitungSchalter.selected && keyword !== "TEST" ? " + K" : ""),
            message: beschreibungFeld.value,
            details: detailsFeld.value + fullPlaceDesc,
            lat: place?.lat ?? null,
            lng: place?.lng ?? null,

        };

        const dataString = JSON.stringify(data);
        overlay.style.display = 'flex';
        fetch(`/triggerAlarm?securitykey=${securityKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: dataString
        }).then(response => {
                if (response.ok) {
                    resetUI()
                } else if (response.status !== 200) {
                    sendBackupAlarm(data)
                    alert('Fehler beim Auslösen der Alarms! Wechsel auf Backup!')
                }
            }
        ).catch(() => alert('Fehler beim Auslösen des Alarms!'))
    }

    function sendBackupAlarm(data) {
        data.keyword = "TEST"
        fetch(`/triggerAlarm?securitykey=${securityKey}`, {
            method: "POST",
            headers: {"Content-Type": "application/json",},
            body: JSON.stringify(data)
        }).then(r => {
            if (r.ok) {
                resetUI()
                alert('Backup wurde erfolgreich ausgelöst!')
            }
        }).catch(() => alert('Fehler beim Auslösen des Backups!'))
    }

    function sendPushMessage() {
        // UI blockieren und Spinner anzeigen
        push.disabled = true;
        pushSelect.disabled = true;
        pushButton.disabled = true;
        pushSpinner.style.display = 'flex';

        const data = {
            groups: [pushSelect.value],
            message: push.value,
        }

        fetch(`/pushMessage?securitykey=${securityKey}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        }).then(r => {
            if (r.ok) {
                resetPush()
                alert("Push erfolgreich gesendet")
            } else {
                alert("Fehler beim Senden der Push-Nachricht.")
            }
        }).catch(err => {
            console.error("Fehler beim Senden der Push-Nachricht:", err);
            alert("Ein Netzwerkfehler ist aufgetreten.");
        }).finally(() => {
            // UI wieder freigeben und Spinner ausblenden
            push.disabled = false;
            pushSelect.disabled = false;
            pushButton.disabled = false;
            pushSpinner.style.display = 'none';
        })
    }

    function resetUI() {
        typFeld.value = ""
        ortFeld.value = ""
        detailsFeld.value = ""
        beschreibungFeld.value = ""
        leitungSchalter.selected = false
        ortIcon.style.display = 'none'
        place = null
        overlay.style.display = 'none'
        updateFFAgentData()
    }

    function resetPush() {
        pushSelect.selectedIndex = 0;
        push.value = "";
    }

    alarmButton.addEventListener("click", sendAlarm);
    pushButton.addEventListener("click", sendPushMessage)

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
            const [callRes, peopleRes] = await Promise.all([
                fetch(`/call?securitykey=${securityKey}`, {method: "POST"}).then(r => r.json()),
                fetch(`/people?securitykey=${securityKey}`, {method: "POST"}).then(r => r.json())
            ]);

            setAlarmInfo(callRes);
            setPeopleList(peopleRes);
        } catch (error) {
            console.error("Fehler beim Abrufen der Daten:", error);
        }
    }

    function setPeopleList(data) {
        peopleList.innerHTML = "";
        peopleList.style.padding = "0"
        if (!Object.keys(data).length) {
            peopleList.innerHTML = `<md-list-item><div>Liste leer</div></md-list-item>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        const headline = document.createElement("h2");
        console.log(data.persons?.available)
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
