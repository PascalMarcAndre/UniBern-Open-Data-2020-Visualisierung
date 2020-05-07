/*******************************************************************************************************
 * GLOBAL VARIABLES
 * Variables used throughout the application.
 ******************************************************************************************************/
// Endpoint URL for LINDAS SPARQL queries
const LINDAS_ENDPOINT = "https://lindas.admin.ch/query";



/*******************************************************************************************************
 * LAUNCH PROCESS
 ******************************************************************************************************/

/**
 * Calls helper functions that set up the page.
 * Includes creation of Leaflet map, fetching data with SPARQL requests etc.
 */
function launch() {
    createLeafletMap();
    createLeafletTiles();
    createClusterLayer();

    createHeatmapLayer();
}



/*******************************************************************************************************
 * LEAFLET
 * Functions and variables responsible for creating the Leaflet map and its layers etc.
 ******************************************************************************************************/

// Leaflet map
let map;

// List of available Leaflet tile layers
let tiles = [];

// Range of zoom levels of tile layers
const MIN_ZOOM = 7;
const MAX_ZOOM = 17;

// Leaflet layer that contains all stations and displays them in clusters
let clusterLayer = new L.layerGroup();

// Leaflet layer that contains all markers that match the given search term
let searchResultsLayer = new L.layerGroup();


// Leaflet layer that contains the heatmap of the short distance count of each station
let heatmapLayer = new L.layerGroup();

/**
 * Creates Leaflet map. Sets initial view to fit Switzerland.
 */
function createLeafletMap() {
    // Create Leaflet map object
    map = L.map('map', {
        zoomControl: false,
        renderer: L.svg({ padding: 100 }),
    });

    // Set initial map view to fit Switzerland
    map.fitBounds([
        [45.7769477403, 6.02260949059],
        [47.8308275417, 10.4427014502]
    ]);

    map.on('zoom', updateZoomButtons);

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
        className: 'saturation',
        tileSize: 512,
        zoomOffset: -1,
        id: 'mapbox/streets-v11',
    }).addTo(map);

    // OpenStreetMap Swiss Style
    tiles[1] = L.tileLayer('http://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        className: 'saturation',
    });

    // OpenTopoMap
    tiles[2] = L.tileLayer('https://opentopomap.org/{z}/{x}/{y}.png', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        className: 'saturation',
    });

    // ArcGIS Satellite
    tiles [3] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        className: 'saturation',
    });
}

/**
 * Creates and sets up the cluster layer which includes all stations. Requests and processes all the data.
 * Custom cluster layer options are set during creation incl. cluster radius and disabling clustering for highest levels.
 * Each station gets added as marker to cluster layer. Adds cluster layer to the map since it is the default layer.
 */
function createClusterLayer() {
    // Add default cluster layer containing all stations to map since it is default layer
    clusterLayer = L.markerClusterGroup({
        maxClusterRadius: 150,
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: false
    }).addTo(map);

    d3.sparql(LINDAS_ENDPOINT, query_allStations()).then(data => {
        data.forEach(station => {
            // Create marker (incl. tooltip) and adds it to cluster layer
            L.marker([station.lat, station.lng])
                .addTo(clusterLayer)
                .bindTooltip(station.Name, {opacity: 1, direction: 'top', className: 'tooltip'});
            // TODO: Add click-event to display its short distances
        });
    })
}

/**
 * Creates and sets up the 'Short Distance Count by Station' heatmap. Makes the layer ready to be added to the map.
 * Requests and processes all the data. A heatmap requires a 'max' variable and a 'data' array where each data item
 * requires a 'lat', 'lng' and 'count' variable. Finally, the data gets added to the heatmap layer.
 */
function createHeatmapLayer() {
    d3.sparql(LINDAS_ENDPOINT, query_shortDistanceCountByStation()).then(data => {
        // Set up heatmap layer with custom options
        heatmapLayer = new HeatmapOverlay({
            "radius": 0.012,
            "maxOpacity": .8,
            "scaleRadius": true,
            "useLocalExtrema": true,
            latField: 'lat',
            lngField: 'lng',
            valueField: 'count'
        });

        // Create data object for heatmap
        // Requires 'max' variable and 'data' array where each data item requires 'lat', 'lng' and 'count' variable
        let heatmapData = {
            max: data[0].count,
            data: []
        };

        data.forEach(station => {
            // Add station as data item to data array
            heatmapData.data.push({
                lat: station.lat, lng: station.lng, count: station.count
            });
        });

        // Add requested and processed data to heatmap layer
        heatmapLayer.setData(heatmapData);
    });
}



/*******************************************************************************************************
 * MAP NAVIGATION
 * Functions and variables responsible for map navigation (e.g. set view to certain zoom level or point).
 ******************************************************************************************************/

/**
 * Zooms closer to the map by increasing the zoom level by one. If the maximum zoom level is reached, it stops there.
 */
function zoomIn() {
    let newZoomLevel = map.getZoom() + 1;
    newZoomLevel <= MAX_ZOOM ? map.setZoom(newZoomLevel) : map.setZoom(MAX_ZOOM);
}

/**
 * Zooms further out the map by decreasing the zoom level by one. If the minimum zoom level is reached, it stops there.
 */
function zoomOut() {
    let newZoomLevel = map.getZoom() - 1;
    newZoomLevel < MIN_ZOOM ? map.setZoom(MIN_ZOOM) : map.setZoom(newZoomLevel);
}

/**
 * Updates the zoomIn- and zoomOut-buttons of the control panel according to the current zoom level.
 * Gets called whenever the zoom level of the map changes.
 */
function updateZoomButtons() {
    let zoomInCl = document.getElementById("zoomIn").classList;
    let zoomOutCl = document.getElementById("zoomOut").classList;

    map.getZoom() === MAX_ZOOM ? zoomInCl.add('disabled') : zoomInCl.remove('disabled');
    map.getZoom() === MIN_ZOOM ? zoomOutCl.add('disabled') : zoomOutCl.remove('disabled');
}

/**
 * Centers the map to its initial view and adjusts the zoom level such that the entire country of Switzerland fits on it.
 */
function centerMap() {
    map.flyToBounds([
        [45.7769477403, 6.02260949059],
        [47.8308275417, 10.4427014502]
    ]);
}



/*******************************************************************************************************
 * SEARCH
 * Functions and variables related to the 'Search' section in the sidebar.
 ******************************************************************************************************/

/**
 * Displays all markers that match the user's search terms on the map. Updates search results in sidebar section.
 * Plays fly animation that sets the view to the bounds containing all search result markers.
 */
function showMatchingStations() {
    // Get user's search terms from input field
    let searchTerms = document.getElementById("searchTerms").value;

    // Remove any previous search results from map and sidebar section
    try {map.removeLayer(searchResultsLayer);} catch {}
    document.getElementById("searchResults").innerHTML = "";

    // If the search terms are too short (below 3 characters), the search gets cancelled and message gets displayed
    if (searchTerms.length < 3) {
        document.getElementById("searchResults").innerHTML = "Bitte geben Sie mind. 3 Zeichen ein";
        return;
    }

    // Request all stations matching user's search terms
    d3.sparql(LINDAS_ENDPOINT, query_allStationsMatchingSearchTerms(searchTerms)).then((data) => {

        // Display number of search results
        document.getElementById("searchResults").innerHTML += "<div class='count'>" + data.length + " Resultate:</div>";

        // Reset search results layer to remove any markers on it
        searchResultsLayer = new L.layerGroup();

        // Variables to calculate search result bounds
        let latMin, latMax, lngMin, lngMax;

        // For each station: Add marker to map; Add entry to sidebar list; Update search result bounds
        data.forEach(station => {
            // If latMin is not set, it's the first marker (set all min and max). Otherwise only set if new min or max.
            if (!latMin) {
                latMin = station.lat;
                latMax = station.lat;
                lngMin = station.lng;
                lngMax = station.lng;
            } else {
                if (station.lat < latMin) latMin = station.lat;
                if (station.lat > latMax) latMax = station.lat;
                if (station.lng < lngMin) lngMin = station.lng;
                if (station.lng > lngMax) lngMax = station.lng;
            }

            // Add station to search result list in sidebar section
            document.getElementById("searchResults").innerHTML += "<div class='searchItem'>" + station.Name + "</div>";

            // Add station as marker to search results layer and bind popup with station name
            L.marker([station.lat, station.lng])
                .addTo(searchResultsLayer)
                .bindTooltip(station.Name, {opacity: 1, direction: 'top', className: 'tooltip'});
        });

        // Add layer containing all search result markers to map
        searchResultsLayer.addTo(map);

        // Plays fly animation to bounds containing all search result markers
        // Only plays if search results contains at least one item (which sets bound variables)
        try {
            map.flyToBounds([
                [latMin, lngMin],
                [latMax, lngMax]
            ]);
        } catch {}
    });
}

/**
 * Resets the search option by emptying the input field and search results list.
 * Removes the layer containing all matching markers from the map and also removes all items from the layer itself.
 */
function resetSearch() {
    document.getElementById("searchTerms").value = "";
    document.getElementById("searchResults").innerHTML = "";
    map.removeLayer(searchResultsLayer);
    searchResultsLayer.clearLayers();
}

/**
 * Gets called whenever the user pressed a key while typing in the input field for searching stations.
 * If the pressed key was 'ENTER' the search gets triggered and any old search results are removed from the sidebar.
 * This is an alternative for triggering the search instead of having to press the actual search button.
 *
 * @param event                   Object that triggered the event leading to calling this function
 */
function startSearchIfEnterWasPressed(event) {
    // If 'ENTER' was pressed, start search
    if (event.keyCode === 13) {
        // Cancel the default action, if needed
        event.preventDefault();

        // Start search
        showMatchingStations();

        // Empty div-element that displays search results
        $("#stations").empty();
    }
}



/*******************************************************************************************************
 * OPTIONS
 * Functions and variables related to the 'Options' section in the sidebar.
 ******************************************************************************************************/

/**
 * Selects the tile layer with the given ID for the map and updates the tile preview section.
 *
 * @param tileID                  ID of the tile layer to be selected
 */
function setTileLayer(tileID) {
    // Removes all tile layers form the map and resets the boxes in the tile layer selection
    tiles.forEach((tile, index) => {
        map.removeLayer(tile);
        document.getElementById('tile' + index).classList.remove('selected');
    });

    // Adds chosen tile layer to map and marks its preview box as selected
    map.addLayer(tiles[tileID]);
    document.getElementById('tile' + tileID).classList.add('selected');
}

/**
 * Updates saturation CSS-variable according to new greyscale value. Gets updated whenever related slider moves.
 *
 * @param greyscale               New saturation value (gets calculated with 1-greyscale)
 */
function updateSaturation(greyscale) {
    document.documentElement.style.setProperty('--gs', ((1-greyscale).toString()));
}

/**
 * Updates opacity for all tile layers with given opacity value. Updates whenever related slider moves.
 *
 * @param opacity                 New opacity value to be set for all tile layers
 */
function updateOpacity(opacity) {
    tiles.forEach(tile => {
        tile.setOpacity(opacity);
    });
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

/**
 * Removes all layers from the map. Called when the user selects a different layer to be shown.
 */
function removeAllLayers() {
    // List of layers to be removed
    const layers = [clusterLayer, searchResultsLayer, currentAnalyseLayer];

    // Remove each layer from the map
    layers.forEach(layer => {
        layer.removeFrom(map);
    });
}
