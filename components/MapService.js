import { debugLog } from "./ApiService.js";
import {PlaceRepository} from "./PlaceRepository"
import * as L from "leaflet"

const MAP_CONFIG = {
    bounds: L.latLngBounds(
        [48.13864, 11.39749], // Südwestlichster Punkt
        [48.14501, 11.41272]  // Nordöstlichster Punkt
    ),
    initialView: [48.14187474610397, 11.40346616384037],
    initialZoom: 16.5,
    minZoom: 15,
    poiMarker: {
        radius: 8,
        defaultColor: 'blue',
        selectedColor: 'red',
        fillOpacity: 0.8,
    },
};

const SOURCE_TYPE = {
    POI: 'poi',
    MANUAL: 'manual',
};

/**
 * Verwaltet alle Interaktionen und den Zustand der Leaflet-Karte.
 * Diese Klasse ist entkoppelt von der Haupt-UI und kommuniziert über einen Callback.
 */
export class MapService {
    /**
     * @param {string} mapContainerId Die ID des HTML-Elements, das die Karte enthalten soll.
     * @param {function(object): void} onLocationSelect Ein Callback, der aufgerufen wird, wenn ein Ort ausgewählt wird.
     *        Das übergebene Objekt hat die Form: {name?: string, lat: number, lng: number, source: 'poi' | 'manual'}
     */
    constructor(mapContainerId, onLocationSelect) {
        this.mapContainer = document.getElementById(mapContainerId);
        if (!this.mapContainer) {
            throw new Error(`Map container with id "${mapContainerId}" not found.`);
        }
        this.onLocationSelect = onLocationSelect;

        // --- Interne Zustandsvariablen ---
        this.map = null;
        this.poiMarkers = new Map(); // Hält die Referenzen auf die Marker für den schnellen Zugriff
        this.poiLayerGroup = L.layerGroup(); // Bündelt alle POI-Marker für einfaches Hinzufügen/Entfernen
        this.manualMarker = null;
        this.activePoiMarker = null;
    }

    /**
     * Initialisiert die Karte, die Kachelebene und die Steuerelemente.
     */
    initialize() {
        this.map = L.map(this.mapContainer, {
            maxBounds: MAP_CONFIG.bounds,
            maxBoundsViscosity: 1.0,
            doubleClickZoom: false, // Deaktiviert, da wir es für das Setzen von Markern verwenden
            minZoom: MAP_CONFIG.minZoom,
            zoomSnap: 0.1,
            zoomDelta: 0.1,
        }).setView(MAP_CONFIG.initialView, MAP_CONFIG.initialZoom);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(this.map);

        L.control.scale({ imperial: false, metric: true }).addTo(this.map);

        // Event-Listener für Karteninteraktionen
        this.map.on('drag', () => this.map.panInsideBounds(MAP_CONFIG.bounds, { animate: false }));
        this.map.on('dblclick', this._handleMapClick.bind(this));
        this.addPois()
    }

    /**
     * Fügt die Points of Interest (PoI) aus einer Datenquelle zur Karte hinzu.
     * Diese Methode kann aufgerufen werden, bevor die Karte sichtbar ist.
     * Die Marker werden erst beim ersten Anzeigen der Karte hinzugefügt.
     */
    addPois() {
        if (this.poiMarkers.size > 0) return; // Bereits initialisiert

        const poiData = new PlaceRepository().getAllPlaceNames();
        debugLog("[MapService]", "Adding POIs to map", poiData);

        poiData.forEach(({ name, lat, lng }) => {
            const marker = L.circleMarker([lat, lng], {
                color: MAP_CONFIG.poiMarker.defaultColor,
                radius: MAP_CONFIG.poiMarker.radius,
                fillOpacity: MAP_CONFIG.poiMarker.fillOpacity,
            })
                .bindPopup(`<b>${name}</b>`)
                .on('click', () => this._handlePoiClick(marker, { name, lat, lng }))
                .on('mouseover', (e) => e.target.openPopup())
                .on('mouseout', (e) => e.target.closePopup());

            this.poiMarkers.set(name, marker);
            this.poiLayerGroup.addLayer(marker);
        });
    }

    /**
     * Wählt einen Ort programmatisch anhand seines Namens aus und hebt ihn auf der Karte hervor.
     * @param {string} placeName - Der Name des Ortes.
     */
    selectPlaceByName(placeName) {
        debugLog("[MapService]", "Programmatically selecting place", placeName);
        this.resetSelection();
        const marker = this.poiMarkers.get(placeName);
        if (marker) {
            marker.setStyle({ color: MAP_CONFIG.poiMarker.selectedColor });
            this.activePoiMarker = marker;
            // this.map.setView(marker.getLatLng(), 18); // Zoom in for selection
        }
    }

    /**
     * Setzt die Auswahl (manuell und PoI) zurück.
     */
    resetSelection() {
        this._clearManualMarker();
        this._resetPoiStyles();
        this.activePoiMarker = null;
    }

    /**
     * Setzt die Kartenansicht auf die ursprüngliche Position und den Zoom zurück.
     */
    resetView() {
        this.map.setView(MAP_CONFIG.initialView, MAP_CONFIG.initialZoom);
    }

    /**
     * Schaltet die Sichtbarkeit der Karte um und passt die Größe bei Bedarf an.
     */
    toggleVisibility() {
        const isHidden = this.mapContainer.style.display === 'none';
        this.mapContainer.style.display = isHidden ? 'block' : 'none';

        if (isHidden) {
            // Wichtig: Kartengröße neu berechnen, wenn sie sichtbar wird
            this.map.invalidateSize();

            // Füge die POI-Layer-Gruppe zur Karte hinzu, falls sie noch nicht darauf ist.
            if (!this.map.hasLayer(this.poiLayerGroup)) {
                this.poiLayerGroup.addTo(this.map);
            }
        }
    }

    // --- Private Hilfsmethoden ---

    _handlePoiClick(marker, placeData) {
        this.resetSelection();
        marker.setStyle({ color: MAP_CONFIG.poiMarker.selectedColor });
        this.activePoiMarker = marker;
        this.onLocationSelect({ ...placeData, source: SOURCE_TYPE.POI });
    }

    _handleMapClick(e) {
        this.resetSelection();
        const { lat, lng } = e.latlng;
        const latLng = [lat, lng];

        if (!this.manualMarker) {
            this.manualMarker = L.marker(latLng).addTo(this.map);
        } else {
            this.manualMarker.setLatLng(latLng);
        }

        this.manualMarker.bindPopup(`<b>Ausgewählter Einsatzort</b>`).openPopup();
        this.onLocationSelect({ lat, lng, source: SOURCE_TYPE.MANUAL });
    }

    _clearManualMarker() {
        if (this.manualMarker) {
            this.manualMarker.remove();
            this.manualMarker = null;
        }
    }

    _resetPoiStyles() {
        if (this.activePoiMarker) {
            this.activePoiMarker.setStyle({ color: MAP_CONFIG.poiMarker.defaultColor });
        }
    }
}