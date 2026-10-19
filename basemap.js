
// University of Waterloo main campus
const Campus_Centerpoint = [43.4723, -80.5449];

// Initialize Leaflet map
const map = L.map('map').setView(Campus_Centerpoint, 16);

// Add OpenStreetMap basemap tiles
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Add a scale bar
L.control.scale().addTo(map);
