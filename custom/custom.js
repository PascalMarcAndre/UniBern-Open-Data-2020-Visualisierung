/*******************************************************************************************************
 * GLOBAL VARIABLES
 ******************************************************************************************************/
// Leaflet map
let map;

// List of available Leaflet tiles
let tiles = [];

// Endpoint URL for LINDAS SPARQL queries
const LINDAS_ENDPOINT = "https://lindas.admin.ch/query";

// Range of zoom levels of tile layers
const MIN_ZOOM = 7;
const MAX_ZOOM = 17;


/*******************************************************************************************************
 * FUNCTIONS
 ******************************************************************************************************/

/**
 * Calls helper functions that set up the page.
 * Includes creation of Leaflet map, fetching data with SPARQL requests etc.
 */
function launch() {
    createLeafletMap();
    createLeafletTiles();
    setSidebarElement("Welcome");
}

/**
 * Creates Leaflet map. Sets initial view to fit Switzerland.
 */
function createLeafletMap() {
    // Create Leaflet map object
    map = L.map('map', {
        zoomControl: false
    });

    // Set initial map view to fit Switzerland
    map.fitBounds([
        [45.7769477403, 6.02260949059],
        [47.8308275417, 10.4427014502]
    ]);

    // Fix grid lines between tile images
    let originalInitTile = L.GridLayer.prototype._initTile;
    L.GridLayer.include({
        _initTile: function(tile) {
            originalInitTile.call(this, tile);
            let tileSize = this.getTileSize();
            tile.style.width = tileSize.x + 1 + 'px';
            tile.style.height = tileSize.y + 1 + 'px';
        }
    });
}

/**
 * Creates Leaflet tile layers. Adds default tile layer to Leaflet map.
 */
function createLeafletTiles() {
    // Mapbox
    tiles[0] = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        tileSize: 512,
        zoomOffset: -1,
        id: 'mapbox/streets-v11',
    }).addTo(map);

    // OpenStreetMap Swiss Style
    tiles[1] = L.tileLayer('http://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
    });

    // OpenTopoMap
    tiles[2] = L.tileLayer('https://opentopomap.org/{z}/{x}/{y}.png', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
    });

    // ArcGIS Satellite
    tiles [3] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
    });
}

/**
 * Requests and adds all stations from Libero to map
 * TODO: Make certain parts regarding D3 reusable (e.g. adding circles and lines etc.)
 */
var clickedAll = false;
var mapMarkers = []
function showAllStationsLibero() {
    if (!clickedAll) {
        d3.sparql(LINDAS_ENDPOINT, query_allStationsLibero()).then((data) => {
            console.log(data); // TODO: Remove

            // TODO: Use D3 instead of Leaflet
            data.forEach(station => {
                const coords = station.Coord.replace("POINT(", "").replace(")", "").split(' ');

                marker = L.marker([coords[1], coords[0]])
                marker.addTo(map).bindPopup(station.Name);
                this.mapMarkers.push(marker);

            });
            clickedAll = true

        });
    }
    else {
        for (var i = 0; i < this.mapMarkers.length; i++) {
            map.removeLayer(this.mapMarkers[i]);

        }
        clickedAll = false

    }

}

/**
 * Requests and adds 100 longest short distances to map
 * TODO: Make certain parts regarding D3 reusable (e.g. adding circles and lines etc.)
 */
var clickedShortest = false;
var mapElements = []

function show100LongestShortDistances() {
    if (!clickedShortest) {

        d3.sparql(LINDAS_ENDPOINT, query_100longestShortDistances()).then((data) => {
            console.log(data); // TODO: Remove

            // TODO: Use D3 instead of Leaflet
            data.forEach(route => {
                const coords1 = route.loc1.replace("POINT(", "").replace(")", "").split(' ');
                const coords2 = route.loc2.replace("POINT(", "").replace(")", "").split(' ');

                marker1 = L.marker([coords1[1], coords1[0]])
                marker1.addTo(map).bindPopup(route.stNam1);
                marker2 = L.marker([coords2[1], coords2[0]])
                marker2.addTo(map).bindPopup(route.stNam2);
                polyline = L.polyline([[coords1[1], coords1[0]], [coords2[1], coords2[0]]], { color: 'blue' })
                polyline.addTo(map);
                this.mapElements.push(marker1,marker2,polyline);

            });
            clickedShortest = true
        });
    }
    else {
        for (var i = 0; i < this.mapElements.length; i++) {
            map.removeLayer(this.mapElements[i]);
        }
        clickedShortest = false

    }


}



/*******************************************************************************************************
 * USER INTERFACE
 * Functions and variables that keep track of the user interface and modify it.
 ******************************************************************************************************/

// Boolean for whether the sidebar is opened or closed
let sidebarOpen = true;

/**
 * Toggles the sidebar on and off.
 */
function toggleSidebar() {
    let elCList = document.getElementById("sidebar").classList;
    sidebarOpen ? elCList.add("closed") : elCList.remove("closed");

    sidebarOpen = !sidebarOpen;
}

/**
 * Displays content of selected sidebar section according to given parameter and sets its menu button as selected.
 * Opens the sidebar if it was previously closed.
 *
 * @param newSection              ID/Name of the newly selected sidebar section
 */
function setSidebarElement(newSection) {
    // Opens the sidebar if currently closed
    if(!sidebarOpen) {
        toggleSidebar();
    }

    // List of sidebar section names
    let sectionNames = ["Welcome", "Search", "Distance", "Options", "Help", "About"];

    // Hides content of all sidebar elements and deselects all menu buttons
    sectionNames.forEach(sectionName => {
        document.getElementById("sbSec" + sectionName).classList.add("hidden");
        document.getElementById("sbBtn" + sectionName).classList.remove("selected");
    });

    // Displays content of selected section according to given parameter and sets its menu button as selected
    document.getElementById("sbSec" + newSection).classList.remove("hidden");
    document.getElementById("sbBtn" + newSection).classList.add("selected");
}