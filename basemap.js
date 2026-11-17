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
        const response = await fetch("data/FoodServices_Locations.geojson");
        if (!response.ok) {
            throw new Error(`Unable to load GeoJSON (HTTP ${response.status})`);
        }
        const geojson = await response.json();
        const locationsLayer = L.geoJSON(geojson, {
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
        const response = await fetch("data/StudentSocieties_Locations.geojson");
        if (!response.ok) {
            throw new Error(`Unable to load Student Societies GeoJSON (HTTP ${response.status})`);
        }
        const geojson = await response.json();
        const studentSocietyLayer = L.geoJSON(geojson, {
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
