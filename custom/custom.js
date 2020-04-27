/*******************************************************************************************************
 * GLOBAL VARIABLES
 ******************************************************************************************************/
// Leaflet map
let map;

// Endpoint URL for LINDAS SPARQL queries
const LINDAS_ENDPOINT = "https://lindas.admin.ch/query";


/*******************************************************************************************************
 * FUNCTIONS
 ******************************************************************************************************/

/**
 * Calls helper functions that set up the page.
 * Includes creation of Leaflet map, fetching data with SPARQL requests etc.
 */
function launch() {
    createLeafletMap();
}

/**
 * Creates the Leaflet map.
 * Adds tile layer and sets initial view to fit Switzerland.
 */
function createLeafletMap() {
    // Create Leaflet map object
    map = L.map('map');

    // Add tile layer
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
        minZoom: 7,
        maxZoom: 18,
        tileSize: 512,
        zoomOffset: -1,
        id: 'mapbox/streets-v11',
    }).addTo(map);

    // Set initial map view to fit Switzerland
    map.fitBounds([
        [45.7769477403, 6.02260949059],
        [47.8308275417, 10.4427014502]
    ]);
}

/**
 * Requests and adds all stations from Libero to map
 * TODO: Make certain parts regarding D3 reusable (e.g. adding circles and lines etc.)
 */
function showAllStationsLibero() {
    d3.sparql(LINDAS_ENDPOINT, query_allStationsLibero()).then((data) => {
        console.log(data); // TODO: Remove

        // TODO: Use D3 instead of Leaflet
        data.forEach(station => {
            const coords = station.Coord.replace("POINT(", "").replace(")", "").split(' ');

            L.marker([coords[1], coords[0]]).addTo(map).bindPopup(station.Name);
        });
    });
}
