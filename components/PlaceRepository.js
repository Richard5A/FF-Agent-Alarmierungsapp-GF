
export class PlaceRepository {
    constructor() {
        this.dataSource = require("./places.json");
        // Map für exakte Suchen (Namen und Aliase), Case-Insensitive. O(1) Lookup.
        this.exactMatchMap = new Map();
        // Map nur für Orte, die als Präfix dienen. Case-Insensitive.
        this.prefixMatchMap = new Map();

        this.dataSource.forEach(place => {
            const name = place.name.toLowerCase();
            const aliases = (place.aliases ?? []).map(a => a.toLowerCase());

            // Befülle die Map für exakte Treffer mit dem Namen und allen Aliasen.
            this.exactMatchMap.set(name, place);
            aliases.forEach(alias => this.exactMatchMap.set(alias, place));

            // Befülle die Präfix-Map nur, wenn der Ort ein Präfix ist.
            if (place.isPrefix) {
                this.prefixMatchMap.set(name, place);
                aliases.forEach(alias => this.prefixMatchMap.set(alias, place));
            }
        });

        // Die Konsolenausgaben können für das Debugging während der Entwicklung nützlich sein.
        console.log("exactMatchMap", this.exactMatchMap);
        console.log("prefixMatchMap", this.prefixMatchMap);
    }

    /**
     * Findet einen Ort durch exakte Übereinstimmung (Name oder Alias) oder durch ein passendes Präfix.
     * Die Suche ist nicht case-sensitive.
     * @param {string} name Der zu suchende Name des Ortes.
     * @returns {object|null} Das gefundene Ort-Objekt oder null.
     */
    findPlace(name) {
        const lowerCaseName = name.toLowerCase();

        // 1. Exakte Suche (sehr effizient)
        const exactMatch = this.exactMatchMap.get(lowerCaseName);
        if (exactMatch) {
            return exactMatch;
        }

        // 2. Präfix-Suche (aufwändiger, aber optimiert)
        // Iteriere über die Einträge der Präfix-Map. Die Schlüssel sind bereits kleingeschrieben.
        for (const [prefix, place] of this.prefixMatchMap.entries()) {
            if (lowerCaseName.startsWith(prefix)) {
                return place;
            }
        }

        return null;
    }

    getAllPlaceNames() {
        return require("./places.json");
    }
}
