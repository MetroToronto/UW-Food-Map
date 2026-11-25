// University of Waterloo campus center
const Campus_Centerpoint = [43.4723, -80.5449];

// Initialize the Leaflet map
const map = L.map("map").setView(Campus_Centerpoint, 16);

// Add OpenStreetMap basemap and scale
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
L.control.scale().addTo(map);

// Load UW Food Services buildings
async function loadFoodServiceLocations() {
    try {
        const response = await fetch("geojson-data/FoodServices_Locations.geojson");
        if (!response.ok) {
            throw new Error(`Unable to load GeoJSON (HTTP ${response.status})`);
        }
        const geojson = await response.json();
        
const locationsLayer = L.geoJSON(geojson, {

    // Create circular building code icons
    pointToLayer: (feature, latlng) => {

        const buildingCode =
            feature.properties?.BuildingCode || "?";

        // Create the text inside the circle
        const label = document.createElement("div");
        label.className = "uw-building-circle";
        label.textContent = buildingCode;

        // Create the Leaflet icon
        const building = L.div({
            html: label,
            className: "uw-building-icon",
            iconSize: [50, 50],
            iconAnchor: [25, 25],
            popupAnchor: [0, -25]
        });

        return L.marker(latlng, {
            icon: buildingIcon
        });
    },

    onEachFeature: (feature, layer) => {

                const popup = createFoodPopup(feature.properties || {}, "foodServices");
                layer.bindPopup(popup, {
                    className: "food-location-popup",
                    minWidth: 260,
                    maxWidth: 380
                });
            }
        }).addTo(map);
        console.log(`Loaded ${locationsLayer.getLayers().length} UW Food Services location(s).`);
    } catch (error) {
        console.error("Failed to load food-service locations:", error);
    }
}

// Load student society C&D locations
async function loadStudentSocietyLocations() {
    try {
        const response = await fetch("geojson-data/StudentSocieties_Locations.geojson");
        if (!response.ok) {
            throw new Error(`Unable to load Student Societies GeoJSON (HTTP ${response.status})`);
        }
        const geojson = await response.json();
        const studentSocietyLayer = L.geoJSON(geojson, {

    // Display the corresponding Student Society icon
    pointToLayer: (feature, latlng) => {
        const code = feature.properties?.StudentSocietyCode;

        const availableIcons = [
            "AHSUM", "ASU", "ESS", "EngSoc",
            "MathSoc", "SciSoc", "WUSA"
        ];

        // Use the default marker if no matching icon exists
        if (!availableIcons.includes(code)) {
            return L.marker(latlng);
        }

        const societyIcon = L.icon({
            iconUrl: `icons/${code}.png`,
            iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -25]
        });

        return L.marker(latlng, {
            icon: societyIcon
        });
    },

    onEachFeature: (feature, layer) => {
                const popup = createFoodPopup(feature.properties || {}, "studentSociety");
                layer.bindPopup(popup, {
                    className: "food-location-popup",
                    minWidth: 260,
                    maxWidth: 380
                });
            }
        }).addTo(map);
        console.log(`Loaded ${studentSocietyLayer.getLayers().length} student society location(s).`);
    } catch (error) {
        console.error("Failed to load Student Society locations:", error);
    }
}

// Show both location types when the webpage loads
loadFoodServiceLocations();
loadStudentSocietyLocations();
