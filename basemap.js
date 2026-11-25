// ------------------------------------------------------------
// MAP STARTING POSITION, ZOOM, AND MOVEMENT RESTRICTIONS
// ------------------------------------------------------------
// Chosen starting map centre (latitude, longitude).
const Campus_Centerpoint = [43.471651, -80.545690];
const START_ZOOM = 16.25; // Maximum permitted zoom-out

// Limits how far users can pan when zoomed in.
const CAMPUS_BOUNDS = L.latLngBounds(
    [43.4570, -80.5659], // Southwest
    [43.4890, -80.5219]  // Northeast
);

const map = L.map("map", {
    zoomSnap: 0.25,
    zoomDelta: 0.25,
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
// UW Food Services, colleges, and Student Society icons are 50px.
// WUSA has a larger, 75px icon. Maintain an 8px gap for all icons.
const STANDARD_ICON_SIZE = 50;
const WUSA_ICON_SIZE = 75;
const MARKER_GAP_PX = 8;

// Keep original GeoJSON positions unchanged.
const foodMapMarkers = [];

function registerFoodMapMarker(marker, iconSize = STANDARD_ICON_SIZE) {
    const originalLatLng = marker.getLatLng();

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

    foodMapMarkers.push({
        marker,
        iconSize,
        originalLatLng,
        leaderLine,
        originalDot
    });
}

// Compare the sizes of both markers to preserve the same pixel gap.
function markersWouldOverlap(candidate, candidateSize, used) {
    const requiredSeparation =
        (candidateSize + used.iconSize) / 2 + MARKER_GAP_PX;

    return (
        Math.abs(candidate.x - used.point.x) < requiredSeparation &&
        Math.abs(candidate.y - used.point.y) < requiredSeparation
    );
}

function findAvailableMarkerPosition(origin, iconSize, usedPositions, markerIndex) {
    const isOccupied = (point) => usedPositions.some(
        used => markersWouldOverlap(point, iconSize, used)
    );

    // Stay at the exact location whenever possible.
    if (!isOccupied(origin)) return origin;

    const startingAngle = markerIndex * 2.399963229728653;

    // Search outward until there is room for the entire marker.
    for (let radius = 8; radius <= 800; radius += 8) {
        const positionsToTry = Math.max(16, Math.ceil(2 * Math.PI * radius / 12));

        for (let i = 0; i < positionsToTry; i++) {
            const angle = startingAngle + 2 * Math.PI * i / positionsToTry;
            const candidate = L.point(
                origin.x + Math.cos(angle) * radius,
                origin.y + Math.sin(angle) * radius
            );

            if (!isOccupied(candidate)) return candidate;
        }
    }

    // Fallback in exceptionally dense areas.
    return origin;
}

function updateMarkerSpacing() {
    // Deterministic order even if the GeoJSON datasets load separately.
    const entries = [...foodMapMarkers].sort((a, b) =>
        a.originalLatLng.lat - b.originalLatLng.lat ||
        a.originalLatLng.lng - b.originalLatLng.lng ||
        a.iconSize - b.iconSize
    );

    const usedPositions = [];

    entries.forEach((entry, index) => {
        const exactPoint = map.latLngToLayerPoint(entry.originalLatLng);
        const displayedPoint = findAvailableMarkerPosition(
            exactPoint,
            entry.iconSize,
            usedPositions,
            index
        );

        usedPositions.push({ point: displayedPoint, iconSize: entry.iconSize });

        const shiftedDistance = Math.hypot(
            displayedPoint.x - exactPoint.x,
            displayedPoint.y - exactPoint.y
        );

        if (shiftedDistance < 1) {
            entry.marker.setLatLng(entry.originalLatLng);
            if (map.hasLayer(entry.leaderLine)) map.removeLayer(entry.leaderLine);
            if (map.hasLayer(entry.originalDot)) map.removeLayer(entry.originalDot);
        } else {
            const shiftedLatLng = map.layerPointToLatLng(displayedPoint);
            entry.marker.setLatLng(shiftedLatLng);
            entry.leaderLine.setLatLngs([entry.originalLatLng, shiftedLatLng]);

            if (!map.hasLayer(entry.leaderLine)) entry.leaderLine.addTo(map);
            if (!map.hasLayer(entry.originalDot)) entry.originalDot.addTo(map);
        }
    });
}

map.on("zoomend moveend resize", updateMarkerSpacing);

// Shared icon for UW Food Services and college building-code markers.
function createBuildingCodeMarker(feature, latlng) {
    const buildingCode = feature.properties?.BuildingCode || "?";

    const label = document.createElement("div");
    label.className = "uw-building-circle";
    label.textContent = buildingCode;

    const buildingIcon = L.divIcon({
        html: label,
        className: "uw-building-icon",
        iconSize: [STANDARD_ICON_SIZE, STANDARD_ICON_SIZE],
        iconAnchor: [STANDARD_ICON_SIZE / 2, STANDARD_ICON_SIZE / 2],
        popupAnchor: [0, -STANDARD_ICON_SIZE / 2]
    });

    return L.marker(latlng, { icon: buildingIcon });
}

// Keep the same clickable, three-tab popup on every marker.
function attachFoodPopup(feature, layer, locationType, iconSize = STANDARD_ICON_SIZE) {
    const popup = createFoodPopup(feature.properties || {}, locationType);
    layer.bindPopup(popup, {
        className: "food-location-popup",
        minWidth: 260,
        maxWidth: 380
    });
    registerFoodMapMarker(layer, iconSize);
}

// ------------------------------------------------------------
// UW FOOD SERVICES LOCATIONS
// ------------------------------------------------------------
async function loadFoodServiceLocations() {
    try {
        const response = await fetch("geojson-data/FoodServices_Locations.geojson");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = await response.json();

        const layer = L.geoJSON(geojson, {
            pointToLayer: createBuildingCodeMarker,
            onEachFeature: (feature, marker) => {
                attachFoodPopup(feature, marker, "foodServices");
            }
        }).addTo(map);

        updateMarkerSpacing();
        console.log(`Loaded ${layer.getLayers().length} UW Food Services location(s).`);
    } catch (error) {
        console.error("Failed to load UW Food Services locations:", error);
    }
}

// ------------------------------------------------------------
// STUDENT SOCIETY LOCATIONS
// ------------------------------------------------------------
async function loadStudentSocietyLocations() {
    try {
        const response = await fetch("geojson-data/StudentSocieties_Locations.geojson");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = await response.json();

        const availableIcons = [
            "AHSUM", "ASU", "ESS", "EngSoc", "GSA", "MathSoc", "SciSoc"
        ];

        const layer = L.geoJSON(geojson, {
            // WUSA is now loaded from its own WUSA_Location.geojson file.
            // Prevent a duplicate if it also exists in the society data.
            filter: feature => feature.properties?.StudentSocietyCode !== "WUSA",

            pointToLayer: (feature, latlng) => {
                const code = feature.properties?.StudentSocietyCode;
                if (!availableIcons.includes(code)) return L.marker(latlng);

                const societyIcon = L.icon({
                    iconUrl: `icons/${code}.png`,
                    iconSize: [STANDARD_ICON_SIZE, STANDARD_ICON_SIZE],
                    iconAnchor: [STANDARD_ICON_SIZE / 2, STANDARD_ICON_SIZE / 2],
                    popupAnchor: [0, -STANDARD_ICON_SIZE / 2]
                });

                return L.marker(latlng, { icon: societyIcon });
            },

            onEachFeature: (feature, marker) => {
                attachFoodPopup(feature, marker, "studentSociety");
            }
        }).addTo(map);

        updateMarkerSpacing();
        console.log(`Loaded ${layer.getLayers().length} Student Society location(s).`);
    } catch (error) {
        console.error("Failed to load Student Society locations:", error);
    }
}

// ------------------------------------------------------------
// COLLEGE FOOD LOCATIONS
// ------------------------------------------------------------
async function loadCollegeLocations() {
    try {
        const response = await fetch("geojson-data/Colleges_Locations.geojson");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = await response.json();

        const layer = L.geoJSON(geojson, {
            // Identical white circle / black border / building code styling.
            pointToLayer: createBuildingCodeMarker,
            onEachFeature: (feature, marker) => {
                attachFoodPopup(feature, marker, "college");
            }
        }).addTo(map);

        updateMarkerSpacing();
        console.log(`Loaded ${layer.getLayers().length} college location(s).`);
    } catch (error) {
        console.error("Failed to load college locations:", error);
    }
}

// ------------------------------------------------------------
// WUSA LOCATION — 75 x 75 PIXEL IMAGE
// ------------------------------------------------------------
async function loadWusaLocation() {
    try {
        // Singular "Location" is intentional.
        const response = await fetch("geojson-data/WUSA_Location.geojson");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = await response.json();

        const wusaIcon = L.icon({
            iconUrl: "icons/WUSA.png",
            iconSize: [WUSA_ICON_SIZE, WUSA_ICON_SIZE],
            iconAnchor: [WUSA_ICON_SIZE / 2, WUSA_ICON_SIZE / 2],
            popupAnchor: [0, -WUSA_ICON_SIZE / 2]
        });

        const layer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => L.marker(latlng, { icon: wusaIcon }),
            onEachFeature: (feature, marker) => {
                attachFoodPopup(feature, marker, "wusa", WUSA_ICON_SIZE);
            }
        }).addTo(map);

        updateMarkerSpacing();
        console.log(`Loaded ${layer.getLayers().length} WUSA location(s).`);
    } catch (error) {
        console.error("Failed to load WUSA location:", error);
    }
}

// Load all four datasets.
loadFoodServiceLocations();
loadStudentSocietyLocations();
loadCollegeLocations();
loadWusaLocation();
