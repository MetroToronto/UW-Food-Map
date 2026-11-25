// ------------------------------------------------------------
// MAP STARTING POSITION AND ZOOM
// ------------------------------------------------------------
// Temporary setup: map dragging and panning are UNLOCKED.
// When you choose your ideal centre coordinates, you can
// restore the movement restrictions in a later version.
const Campus_Centerpoint = [43.4729, -80.5439];
const START_ZOOM = 16;

const map = L.map("map", {
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    minZoom: START_ZOOM, // Maximum zoom-out remains 16.5
    maxZoom: 19,
    dragging: true,
    keyboard: true
    // No maxBounds: freely pan while finding your preferred centre.
}).setView(Campus_Centerpoint, START_ZOOM);

map.zoomControl.setPosition("topright");

// ------------------------------------------------------------
// LIVE MAP CENTRE COORDINATE DISPLAY
// ------------------------------------------------------------
// Shows the latitude and longitude at the CENTER of the map,
// not at your mouse cursor or at a marker.
const coordinatesControl = L.control({ position: "topright" });

coordinatesControl.onAdd = function () {
    const panel = L.DomUtil.create("div", "map-coordinates-control");

    // Inline styling: no edits to mapstyle.css are necessary.
    Object.assign(panel.style, {
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        borderRadius: "8px",
        padding: "10px 12px",
        boxShadow: "0 2px 9px rgba(0, 0, 0, 0.18)",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        lineHeight: "1.65",
        color: "#202020",
        minWidth: "165px"
    });

    const title = document.createElement("div");
    title.textContent = "Map centre coordinates";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "3px";

    const latitudeDisplay = document.createElement("div");
    const longitudeDisplay = document.createElement("div");

    panel.append(title, latitudeDisplay, longitudeDisplay);

    function updateCoordinates() {
        const centre = map.getCenter();
        latitudeDisplay.textContent = `Latitude: ${centre.lat.toFixed(6)}`;
        longitudeDisplay.textContent = `Longitude: ${centre.lng.toFixed(6)}`;
    }

    // Update live while dragging, zooming, or moving the map.
    map.on("move zoom resize", updateCoordinates);
    updateCoordinates();

    // Interacting with the box should not drag/zoom the map.
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);

    return panel;
};

coordinatesControl.addTo(map);

// OpenStreetMap basemap and scale
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
L.control.scale().addTo(map);

// ------------------------------------------------------------
// AUTOMATIC MARKER SPACING
// ------------------------------------------------------------
// Both marker types are 50 x 50 screen pixels.
// Keep at least 8 additional pixels between their bounding boxes.
// Markers move only when they overlap; at higher zoom levels, they
// automatically return to their exact GeoJSON locations.
const MARKER_SIZE_PX = 50;
const MARKER_GAP_PX = 8;
const MIN_SEPARATION_PX = MARKER_SIZE_PX + MARKER_GAP_PX;

// Save the true geographic position separately from each displayed marker.
const foodMapMarkers = [];

function registerFoodMapMarker(marker) {
    const originalLatLng = marker.getLatLng();

    // A subtle line shows the marker's real position when it is shifted.
    const leaderLine = L.polyline([], {
        color: "#555555",
        weight: 1.5,
        opacity: 0.7,
        dashArray: "3 4",
        interactive: false
    });

    const originalDot = L.circleMarker(originalLatLng, {
        radius: 2.5,
        color: "#555555",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 1,
        interactive: false
    });

    foodMapMarkers.push({ marker, originalLatLng, leaderLine, originalDot });
}

// Use square bounding boxes, so circles and PNG logos both have a buffer.
function markersWouldOverlap(a, b) {
    return (
        Math.abs(a.x - b.x) < MIN_SEPARATION_PX &&
        Math.abs(a.y - b.y) < MIN_SEPARATION_PX
    );
}

// Find the closest available on-screen spot in expanding circles.
function findAvailableMarkerPosition(origin, usedPositions, markerIndex) {
    if (!usedPositions.some(p => markersWouldOverlap(origin, p))) {
        return origin; // No overlap: use the exact geographic position.
    }

    // Different starting directions keep crowded icons from all moving right.
    const startingAngle = markerIndex * 2.399963229728653;

    for (let radius = 8; radius <= 800; radius += 8) {
        const positionsToTry = Math.max(16, Math.ceil(2 * Math.PI * radius / 12));

        for (let i = 0; i < positionsToTry; i++) {
            const angle = startingAngle + (2 * Math.PI * i / positionsToTry);
            const candidate = L.point(
                origin.x + Math.cos(angle) * radius,
                origin.y + Math.sin(angle) * radius
            );

            if (!usedPositions.some(p => markersWouldOverlap(candidate, p))) {
                return candidate;
            }
        }
    }

    // Unlikely except with very large numbers of markers in one place.
    return origin;
}

function updateMarkerSpacing() {
    // Use a stable ordering, regardless of which GeoJSON file loads first.
    const entries = [...foodMapMarkers].sort((a, b) =>
        a.originalLatLng.lat - b.originalLatLng.lat ||
        a.originalLatLng.lng - b.originalLatLng.lng
    );

    const usedPositions = [];

    entries.forEach((entry, index) => {
        // Work in screen pixels at the CURRENT map zoom.
        const exactPoint = map.latLngToLayerPoint(entry.originalLatLng);
        const displayedPoint = findAvailableMarkerPosition(
            exactPoint,
            usedPositions,
            index
        );

        usedPositions.push(displayedPoint);

        const shiftedDistance = Math.hypot(
            displayedPoint.x - exactPoint.x,
            displayedPoint.y - exactPoint.y
        );

        if (shiftedDistance < 1) {
            // Plenty of space: return to the true location.
            entry.marker.setLatLng(entry.originalLatLng);
            if (map.hasLayer(entry.leaderLine)) map.removeLayer(entry.leaderLine);
            if (map.hasLayer(entry.originalDot)) map.removeLayer(entry.originalDot);
        } else {
            // Crowded area: display slightly aside, without changing GeoJSON.
            const shiftedLatLng = map.layerPointToLatLng(displayedPoint);
            entry.marker.setLatLng(shiftedLatLng);
            entry.leaderLine.setLatLngs([entry.originalLatLng, shiftedLatLng]);

            if (!map.hasLayer(entry.leaderLine)) entry.leaderLine.addTo(map);
            if (!map.hasLayer(entry.originalDot)) entry.originalDot.addTo(map);
        }
    });
}

// Recalculate after zooming, panning, or resizing the browser.
map.on("zoomend moveend resize", updateMarkerSpacing);

// ------------------------------------------------------------
// UW FOOD SERVICES LOCATIONS
// ------------------------------------------------------------
async function loadFoodServiceLocations() {
    try {
        const response = await fetch("geojson-data/FoodServices_Locations.geojson");
        if (!response.ok) {
            throw new Error(`Unable to load GeoJSON (HTTP ${response.status})`);
        }
        const geojson = await response.json();

        const locationsLayer = L.geoJSON(geojson, {
            // White 50px circle with the building code inside
            pointToLayer: (feature, latlng) => {
                const buildingCode = feature.properties?.BuildingCode || "?";

                const label = document.createElement("div");
                label.className = "uw-building-circle";
                label.textContent = buildingCode;

                const buildingIcon = L.divIcon({
                    html: label,
                    className: "uw-building-icon",
                    iconSize: [50, 50],
                    iconAnchor: [25, 25],
                    popupAnchor: [0, -25]
                });

                return L.marker(latlng, { icon: buildingIcon });
            },

            onEachFeature: (feature, layer) => {
                const popup = createFoodPopup(feature.properties || {}, "foodServices");
                layer.bindPopup(popup, {
                    className: "food-location-popup",
                    minWidth: 260,
                    maxWidth: 380
                });
                registerFoodMapMarker(layer);
            }
        }).addTo(map);

        updateMarkerSpacing();
        console.log(`Loaded ${locationsLayer.getLayers().length} UW Food Services location(s).`);
    } catch (error) {
        console.error("Failed to load food-service locations:", error);
    }
}

// ------------------------------------------------------------
// STUDENT SOCIETY LOCATIONS
// ------------------------------------------------------------
async function loadStudentSocietyLocations() {
    try {
        const response = await fetch("geojson-data/StudentSocieties_Locations.geojson");
        if (!response.ok) {
            throw new Error(`Unable to load Student Societies GeoJSON (HTTP ${response.status})`);
        }
        const geojson = await response.json();

        const availableIcons = [
            "AHSUM", "ASU", "ESS", "EngSoc", "GSA", "MathSoc", "SciSoc", "WUSA"
        ];

        const studentSocietyLayer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => {
                const code = feature.properties?.StudentSocietyCode;

                if (!availableIcons.includes(code)) {
                    return L.marker(latlng);
                }

                const societyIcon = L.icon({
                    iconUrl: `icons/${code}.png`,
                    iconSize: [50, 50],
                    iconAnchor: [25, 25],
                    popupAnchor: [0, -25]
                });

                return L.marker(latlng, { icon: societyIcon });
            },

            onEachFeature: (feature, layer) => {
                const popup = createFoodPopup(feature.properties || {}, "studentSociety");
                layer.bindPopup(popup, {
                    className: "food-location-popup",
                    minWidth: 260,
                    maxWidth: 380
                });
                registerFoodMapMarker(layer);
            }
        }).addTo(map);

        updateMarkerSpacing();
        console.log(`Loaded ${studentSocietyLayer.getLayers().length} student society location(s).`);
    } catch (error) {
        console.error("Failed to load Student Society locations:", error);
    }
}

// Load both datasets
loadFoodServiceLocations();
loadStudentSocietyLocations();
