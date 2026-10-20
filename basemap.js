
// University of Waterloo campus center
const Campus_Centerpoint = [43.4723, -80.5449];

// Initialize the Leaflet map
const map = L.map("map").setView(Campus_Centerpoint, 16);

// Add the OpenStreetMap basemap
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Add a map scale
L.control.scale().addTo(map);

// Load food-service building locations from GeoJSON
async function loadFoodServiceLocations() {
    try {
        const response = await fetch(
            "data/FoodServices_Locations.geojson"
        );

        if (!response.ok) {
            throw new Error(
                `Unable to load GeoJSON (HTTP ${response.status})`
            );
        }

        const geojson = await response.json();

        // Create a marker for each GeoJSON location
        const locationsLayer = L.geoJSON(geojson, {
            onEachFeature: (feature, layer) => {

                const properties = feature.properties || {};

                // Create popup with building information
                const popup = document.createElement("div");

                const name = document.createElement("strong");
                name.textContent =
                    properties.buildingName || "Unnamed building";

                popup.appendChild(name);

                if (properties.buildingCode) {
                    const code = document.createElement("div");
                    code.textContent =
                        `Building code: ${properties.buildingCode}`;

                    popup.appendChild(code);
                }

                layer.bindPopup(popup);
            }
        }).addTo(map);

        console.log(
            `Loaded ${locationsLayer.getLayers().length} location(s).`
        );

    } catch (error) {
        console.error(
            "Failed to load food-service locations:",
            error
        );
    }
}

// Load the locations when the website opens
loadFoodServiceLocations();

// Load Student Society food locations
async function loadStudentSocietyLocations() {
    try {
        // 1. Fetch the GeoJSON file
        const response = await fetch(
            "data/StudentSocieties_Locations.geojson"
        );

        if (!response.ok) {
            throw new Error(
                `Unable to load Student Societies GeoJSON (HTTP ${response.status})`
            );
        }

        // 2. Convert response to JavaScript object
        const geojson = await response.json();

        // 3. Add locations to Leaflet
        const studentSocietyLayer = L.geoJSON(geojson, {

            onEachFeature: (feature, layer) => {
                const properties = feature.properties || {};

                // Create popup
                const popup = document.createElement("div");

                const name = document.createElement("strong");
                name.textContent = properties.CnDName || "Unknown C&D";

                const society = document.createElement("p");
                society.textContent =
                    `Student Society: ${properties.StudentSociety}`;

                const building = document.createElement("p");
                building.textContent =
                    `Building: ${properties.BuildingName} (${properties.BuildingCode})`;

                popup.appendChild(name);
                popup.appendChild(society);
                popup.appendChild(building);

                // Attach popup to marker
                layer.bindPopup(popup);
            }

        }).addTo(map);

        console.log(
            `Loaded ${studentSocietyLayer.getLayers().length} student society locations.`
        );

    } catch (error) {
        console.error(
            "Failed to load Student Society locations:",
            error
        );
    }
}

// Run function when website loads
loadStudentSocietyLocations();
