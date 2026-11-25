// ------------------------------------------------------------
// MAP STARTING POSITION, ZOOM, AND MOVEMENT RESTRICTIONS
// ------------------------------------------------------------
// Slightly north and east of the original campus map centre.
const Campus_Centerpoint = [43.4759, -80.5339];
const START_ZOOM = 16.5;

// Limits how far users can pan when zoomed in.
const CAMPUS_BOUNDS = L.latLngBounds(
    [43.4570, -80.5659], // Southwest
    [43.4890, -80.5219]  // Northeast
);

const map = L.map("map", {
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    minZoom: START_ZOOM,
    maxZoom: 19,
    maxBounds: CAMPUS_BOUNDS,
    maxBoundsViscosity: 1.0,
    dragging: false,
    keyboard: false
}).setView(Campus_Centerpoint, START_ZOOM);

map.zoomControl.setPosition("topright");

// At maximum zoom-out, keep the original view in place.
// At closer zooms, allow movement within CAMPUS_BOUNDS.
function updateMapMovement() {
    if (map.getZoom() <= START_ZOOM) {
        map.dragging.disable();
        map.keyboard.disable();
        map.panTo(Campus_Centerpoint, { animate: false });
    } else {
        map.dragging.enable();
        map.keyboard.enable();
    }
}

map.on("zoomend", updateMapMovement);
updateMapMovement();

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
