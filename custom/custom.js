/*******************************************************************************************************
 * GLOBAL VARIABLES
 * Variables used throughout the application.
 ******************************************************************************************************/
// Endpoint URLs for SPARQL queries
const LINDAS_ENDPOINT = "https://lindas.admin.ch/query";
const SWISSTOPO_ENDPOINT = "https://ld.geo.admin.ch/query";

// Name of currently selected sidebar element
let currentSidebarElement = "Welcome";



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
    showZoningplan();

    // Setup analyse layers
    createHeatmapLayer();
    createLongestShortDistancesLayer();
}



/*******************************************************************************************************
 * LEAFLET
 * Functions and variables responsible for creating the Leaflet map and its layers etc.
 ******************************************************************************************************/

// Leaflet map
let map;

// List of all markers which are included in the cluster layer.
// Each marker represents a station that can be accessed with `marker[station.ID]`
let markers = [];

// List of available Leaflet tile layers
let tiles = [];

// Range of zoom levels of tile layers
const MIN_ZOOM = 7;
const MAX_ZOOM = 17;

// Leaflet layer that contains all stations and displays them in clusters
let clusterLayer = new L.layerGroup();

// Leaflet layer that contains all markers that match the given search term
let searchResultsLayer = new L.layerGroup();

// Leaflet layer that contains the current analysis layer
let currentAnalyseLayer = new L.layerGroup();

// Leaflet layer that contains the heatmap of the short distance count of each station
let heatmapLayer = new L.layerGroup();

// Leaflet layer for longest short distance stations
let longestShortDistanceLayer = new L.layerGroup();

// Leaflet layer containing markers and polylines displaying short distances of currently selected station
let currentShortDistancesLayer = new L.layerGroup();

// Leaflet icon of default black/red marker icon
const defaultIcon = L.icon({
    iconUrl: 'assets/icons/marker-icon.png',
    shadowUrl: 'assets/icons/marker-shadow.png',
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41],
    tooltipAnchor: [12, -30]
});

// Leaflet icon of default black/red marker icon
const alternativeIcon = L.icon({
    iconUrl: 'assets/icons/marker-icon-alt.png',
    shadowUrl: 'assets/icons/marker-shadow.png',
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41],
    tooltipAnchor: [12, -30]
});

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

    // Events
    map.on('zoom', updateZoomButtons);
    map.on('zoom', updateSVGElements);
    map.on('click', resetCurrentShortDistancesLayer);

    // Fix grid lines between tile images
    let originalInitTile = L.GridLayer.prototype._initTile;
    L.GridLayer.include({
        _initTile: function (tile) {
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
    tiles[3] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
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
    // Add default cluster layer containing all stations
    clusterLayer = L.markerClusterGroup({
        maxClusterRadius: 150,
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: false
    });

    d3.sparql(SWISSTOPO_ENDPOINT, query_allStations()).then(data => {
        data.forEach(station => {
            // Create marker (incl. tooltip) and add it to cluster layer
            markers[station.ID] = L.marker([station.lat, station.lng], { icon: defaultIcon })
                .addTo(clusterLayer)
                .bindTooltip(station.name, { opacity: 1, direction: 'top', className: 'tooltip' })
                .on("click", () => { showCurrentShortDistances(station) });
        });

        // Add cluster layer to map only if its sidebar section is still selected
        if(currentSidebarElement === "Welcome") {
            clusterLayer.addTo(map);
        }
    });
}

/**
 * Creates and sets up the 'Longest Short Distances' layer. Makes the layer ready to be added to the map.
 * Requests and processes all the data. Each short distance has a start and end point and a connecting line in between.
 */
function createLongestShortDistancesLayer() {
    d3.sparql(LINDAS_ENDPOINT, query_50longestShortDistances()).then(data => {
        data.forEach(shortDistance => {

            // Adds start point of short distance to layer
            L.marker([shortDistance.startLat, shortDistance.startLng], { icon: defaultIcon })
                .addTo(longestShortDistanceLayer)
                .bindTooltip(shortDistance.startName, { opacity: 1, direction: 'top', className: 'tooltip' });

            // Adds end point of short distance to layer
            L.marker([shortDistance.endLat, shortDistance.endLng], { icon: defaultIcon })
                .addTo(longestShortDistanceLayer)
                .bindTooltip(shortDistance.endName, { opacity: 1, direction: 'top', className: 'tooltip' });

            // Adds line from start to end point of short distance to layer
            // TODO: Use D3
            L.polyline([[shortDistance.startLat, shortDistance.startLng], [shortDistance.endLat, shortDistance.endLng]], { color: 'black', weight: 2 })
                .addTo(longestShortDistanceLayer);
        });
    });
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

/**
 * Creates and sets up the 'Distance of Short Distances' visualization.
 * Requests and processes all the data. Counts number of short distances between specific length intervals.
 * Calculates lower bound of number of short distances which are technically too long (above 1.5 km) incl. ratio
 * compared to overall number of short distances. Creates visualization based on given data and adds it to sidebar.
 */
function createDistanceOfShortDistancesVisualization() {
    // Request list with length of each available short distance
    d3.sparql(LINDAS_ENDPOINT, query_distanceOfAllShortDistances()).then(data => {

        // Set up array with specific length intervals to count its number of short distance
        let lengthIntervals = {
            "0.0 < x < 0.5 km": 0,
            "0.5 < x < 1.0 km": 0,
            "1.0 < x < 1.5 km": 0,
            "1.5 < x < 2.0 km": 0,
            "2.0 < x < 2.5 km": 0,
            "2.5 < x < 3.0 km": 0,
            "3.0 < x < 3.5 km": 0,
            "3.5 < x < 4.0 km": 0,
            "4.0 < x < 4.5 km": 0,
            "4.5 < x": 0
        };

        // Assign each short distance to a group according to its length
        data.forEach(shortDistance => {
            // Distance of currently evaluated short distance
            const distance = shortDistance.distance;

            // Increase count of length interval based on length of current short distance
            if(distance < 500) {
                lengthIntervals["0.0 < x < 0.5 km"]++;
                return null;
            } else if (500 <= distance && distance < 1000) {
                lengthIntervals["0.5 < x < 1.0 km"]++;
                return null;
            } else if (1000 <= distance && distance < 1500) {
                lengthIntervals["1.0 < x < 1.5 km"]++;
                return null;
            } else if (1500 <= distance && distance < 2000) {
                lengthIntervals["1.5 < x < 2.0 km"]++;
                return null;
            } else if (2000 <= distance && distance < 2500) {
                lengthIntervals["2.0 < x < 2.5 km"]++;
                return null;
            } else if (2500 <= distance && distance < 3000) {
                lengthIntervals["2.5 < x < 3.0 km"]++;
                return null;
            } else if (3000 <= distance && distance < 3500) {
                lengthIntervals["3.0 < x < 3.5 km"]++;
                return null;
            } else if (3500 <= distance && distance < 4000) {
                lengthIntervals["3.5 < x < 4.0 km"]++;
                return null;
            } else if (4000 <= distance && distance < 4500) {
                lengthIntervals["4.0 < x < 4.5 km"]++;
                return null;
            } else if (4500 <= distance) {
                lengthIntervals["4.5 < x"]++;
                return null;
            }
        });

        // Lower bound number of short distances which technically are too long (over 1.5 km)
        const tooLongShortDistancesCount =
            lengthIntervals["1.5 < x < 2.0 km"] +
            lengthIntervals["2.0 < x < 2.5 km"] +
            lengthIntervals["2.5 < x < 3.0 km"] +
            lengthIntervals["3.0 < x < 3.5 km"] +
            lengthIntervals["3.5 < x < 4.0 km"] +
            lengthIntervals["4.0 < x < 4.5 km"] +
            lengthIntervals["4.5 < x"];

        // Lower bound percentage of how many short distances are technically too long
        const tooLongShortDistancesRatio = tooLongShortDistancesCount/data.length;

        // TODO: Create visualization based on above data
    })
}

/**
 * Shows all short distances of the given station. Adds end point and connecting lines to 'currentShortDistancesLayer'.
 * Clears any markers and lines on this layer from any previous station before adding new ones from current station.
 * Requests and processes all the data. Clicking on end point displays short distances of this station.
 * End points are styled differently with alternative icon and lines change style on hover.
 *
 * @param station                 Station of which the short distances get displayed
 */
function showCurrentShortDistances(station) {
    d3.sparql(LINDAS_ENDPOINT, query_allShortDistancesForStation(station.ID)).then((data) => {
        resetCurrentShortDistancesLayer();

        data.forEach(shortDistance => {
            L.marker([shortDistance.lat, shortDistance.lng], { icon: alternativeIcon, forceZIndex: 1000 })
                .addTo(currentShortDistancesLayer)
                .bindTooltip(shortDistance.name, { opacity: 1, direction: 'top', className: 'tooltip' })
                .on("click", () => { console.log(station); showCurrentShortDistances(shortDistance) });

            let polyline = L.polyline([[station.lat, station.lng], [shortDistance.lat, shortDistance.lng]], { color: 'black', weight: 2 })
                .addTo(currentShortDistancesLayer)
                .on('mouseover', () => { polyline.setStyle({ color: 'red', weight: 5 }) })
                .on('mouseout', () => { polyline.setStyle({ color: 'black', weight: 2 }) });
        });
    });
}

/**
 * Resets the layer that displays the short distances of the currently selected station by removing all markers and lines.
 */
function resetCurrentShortDistancesLayer() {
    // Remove layer displaying current short distance from map
    map.removeLayer(currentShortDistancesLayer);

    // Reset layer by clearing all markers and lines from previous stations
    currentShortDistancesLayer.clearLayers();

    // Re-add layer to make it ready for short distances of new station to be added
    map.addLayer(currentShortDistancesLayer);
}



/*******************************************************************************************************
 * D3
 * Some of the functions and variables specifically related to D3.
 ******************************************************************************************************/

// SVG Layer for the Leaflet map containing only lines
let svgLines = L.svg();

// SVG Layer for the Leaflet map containing only circles
let svgCircles = L.svg();

/**
 * Resets the SVG layers to a predefined case according to the specified string 'resetCase'.
 *
 * @param resetCase               String describing which reset case that should be used. Possible values are:
 *                                'all'             - Remove all circles and lines
 *                                'circle'          - Remove only circles
 *                                'line'            - Remove only lines
 *                                'line-highlight'  - Remove only highlighted lines
 */
function resetSVG(resetCase) {
    switch(resetCase) {
        case "all":
            d3.selectAll("line").remove();
            d3.selectAll("line-highlight").remove();
            d3.selectAll("circle").remove();
            break;
        case "circle":
            d3.selectAll("circle").remove();
            break;
        case "line":
            d3.selectAll("line").remove();
            break;
        case "line-highlight":
            d3.selectAll("line-highlight").remove();
            break;
    }
}

/**
 * Converts LatLng-coordinate into layer point and returns its x-value. Requires 'lat' and 'lng' values for conversion.
 *
 * @param lat                     lat-value of coordinate to be converted into layer point
 * @param lng                     lng-value of coordinate to be converted into layer point
 * @returns {*}                   x-value of layer point from converted LatLng-coordinate
 */
function latLngToX(lat, lng) {
    return map.latLngToLayerPoint([lat, lng]).x;
}

/**
 * Converts LatLng-coordinate into layer point and returns its y-value. Requires 'lat' and 'lng' values for conversion.
 *
 * @param lat                     lat-value of coordinate to be converted into layer point
 * @param lng                     lng-value of coordinate to be converted into layer point
 * @returns {*}                   y-value of layer point from converted LatLng-coordinate
 */
function latLngToY(lat, lng) {
    return map.latLngToLayerPoint([lat, lng]).y;
}

/**
 * Updates all SVG circles and lines after the map has been moved or the zoom level has been changed.
 * Uses helper functions to recalculate the new layer points from the given LatLng-coordinates.
 */
function updateSVGElements() {
    // Update all SVG circles
    d3.selectAll("circle")
        .attr("cx", (d) => { return latLngToX(d.lat, d.lng) })
        .attr("cy", (d) => { return latLngToY(d.lat, d.lng) });

    // Update all SVG lines
    d3.selectAll("line")
        .attr("x1", (d) => { return latLngToX(d.start.lat, d.start.lng) })
        .attr("y1", (d) => { return latLngToY(d.start.lat, d.start.lng) })
        .attr("x2", (d) => { return latLngToX(d.end.lat, d.end.lng) })
        .attr("y2", (d) => { return latLngToY(d.end.lat, d.end.lng) });

    // Update all highlighted SVG lines
    d3.selectAll("line-highlight")
        .attr("x1", (d) => { return latLngToX(d.start.lat, d.start.lng) })
        .attr("y1", (d) => { return latLngToY(d.start.lat, d.start.lng) })
        .attr("x2", (d) => { return latLngToX(d.end.lat, d.end.lng) })
        .attr("y2", (d) => { return latLngToY(d.end.lat, d.end.lng) });
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

/**
 * Plays a smooth fly animation to the given destination on the Leaflet map. Sets zoom level to 'MAX_ZOOM' level.
 * Requires latitude and longitude of the destination in order to play the fly animation.
 *
 * @param lat                     Latitude-value of destination coordinate
 * @param lng                     Longitude-value of destination coordinate
 */
function flyToCoordinate(lat, lng) {
    map.flyTo([lat, lng], MAX_ZOOM);
}

/**
 * Display Numbre of Stations per zoningplan
 */

zoningplanArray = []

function showZoningplan() {


    d3.sparql(LINDAS_ENDPOINT, query_allZoningplans()).then((data) => {

        data.forEach(station => {

            d3.sparql(LINDAS_ENDPOINT, query_ZoningPlanStations(station.Zonenplan)).then((d) => {

                zoningplanArray.push([station.namen, d.length]);

                if (data[data.length-1] === station){
                    //Array with all Zoningplans and their number of Stations
                    console.log(zoningplanArray)
                }
            });
        },
        );
    })
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
    try { map.removeLayer(searchResultsLayer); } catch { }
    document.getElementById("searchResults").innerHTML = "";

    // If the search terms are too short (below 3 characters), the search gets cancelled and message gets displayed
    if (searchTerms.length < 3) {
        document.getElementById("searchResults").innerHTML = "Bitte geben Sie mind. 3 Zeichen ein";
        return;
    }

    // Request all stations matching user's search terms
    d3.sparql(LINDAS_ENDPOINT, query_allStationsMatchingSearchTerms(searchTerms)).then((rawData) => {

        // Display number of search results
        document.getElementById("searchResults").innerHTML += "<div class='count'>" + rawData.length + " Resultate:</div>";

        // Reset search results layer to remove any markers on it
        searchResultsLayer = new L.layerGroup();

        // Variables to calculate search result bounds
        let latMin, latMax, lngMin, lngMax;

        // Set up two empty array: 'data' contains stations whose name starts with search terms, those in 'tmpData' don't
        let data = [];
        let tmpData = [];

        // Add each station to appropriate array depending on its name
        rawData.forEach(item => {
            const src = item.name.toLowerCase();
            const dst = searchTerms.toLowerCase();

            src.startsWith(dst) ? data.push(item) : tmpData.push(item);
        });

        // Append items from 'tmpData' to final 'data' array
        data = data.concat(tmpData);

        // For each station: Add marker to map; Add entry to sidebar list; Update search result bounds
        data.forEach(station => {
            // If latMin is not set, it's the first marker (set all min and max). Otherwise only set if new min or max.
            if (!latMin) {
                latMin = parseFloat(station.lat);
                latMax = parseFloat(station.lat);
                lngMin = parseFloat(station.lng);
                lngMax = parseFloat(station.lng);
            } else {
                if (parseFloat(station.lat) < latMin) latMin = parseFloat(station.lat);
                if (parseFloat(station.lat) > latMax) latMax = parseFloat(station.lat);
                if (parseFloat(station.lng) < lngMin) lngMin = parseFloat(station.lng);
                if (parseFloat(station.lng) > lngMax) lngMax = parseFloat(station.lng);
            }

            // Add station to search result list in sidebar section
            document.getElementById("searchResults").innerHTML += "<div class='searchItem'>" + station.name + "</div>";

            // Add station as marker to search results layer and bind popup with station name
            L.marker([station.lat, station.lng], { icon: defaultIcon })
                .addTo(searchResultsLayer)
                .bindTooltip(station.name, { opacity: 1, direction: 'top', className: 'tooltip' })
                .on("click", () => { showCurrentShortDistances(station) });
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
        } catch { }
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
 * ANALYSE
 * Functions and variables related to the 'Analyse' section in the sidebar.
 ******************************************************************************************************/

/**
 * Displays the selected analyse layer by the user to the map. Removes all layers from map and only adds needed ones.
 *
 * @param event                   Object responsible for calling this function
 */
function updateAnalyseLayer(event) {
    // List of layers to be removed
    const layers = [heatmapLayer, longestShortDistanceLayer];

    // Remove each layer from the map
    layers.forEach(layer => {
        layer.removeFrom(map);
    });

    // Add selected layer back to map
    switch (event.target.value) {
        case ("longestShortDistance"):
            longestShortDistanceLayer.addTo(map);
            currentAnalyseLayer = longestShortDistanceLayer;
            break;
        case ("shortDistanceDistribution"):
            heatmapLayer.addTo(map);
            currentAnalyseLayer = heatmapLayer;
            break;
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
    document.documentElement.style.setProperty('--gs', ((1 - greyscale).toString()));
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
 * Stores currently selected sidebar element in global variable. Opens the sidebar if it was previously closed.
 *
 * @param newSection              ID/Name of the newly selected sidebar section
 */
function setSidebarElement(newSection) {
    // Store name of newly selected section
    currentSidebarElement = newSection;

    // Open the sidebar if currently closed
    if (!sidebarOpen) {
        toggleSidebar();
    }

    // List of sidebar section names
    let sectionNames = ["Welcome", "Search", "Distance", "Options", "Help", "About"];

    // Hide content of all sidebar elements and deselect all menu buttons
    sectionNames.forEach(sectionName => {
        document.getElementById("sbSec" + sectionName).classList.add("hidden");
        document.getElementById("sbBtn" + sectionName).classList.remove("selected");
    });

    // Display content of selected section according to given parameter and set its menu button as selected
    document.getElementById("sbSec" + newSection).classList.remove("hidden");
    document.getElementById("sbBtn" + newSection).classList.add("selected");

    // Display the appropriate Leaflet layer that matches the chosen sidebar element
    switch (newSection) {
        case ("Welcome"):
            removeAllLayers();
            clusterLayer.addTo(map);
            break;
        case ("Search"):
            removeAllLayers();
            searchResultsLayer.addTo(map);
            break;
        case ("Distance"):
            removeAllLayers();
            currentAnalyseLayer.addTo(map);
            break;
    }
}

/**
 * Removes all layers from the map. Called when the user selects a different layer to be shown.
 */
function removeAllLayers() {
    // List of layers to be removed
    const layers = [clusterLayer, searchResultsLayer, currentAnalyseLayer, currentShortDistancesLayer];

    // Remove each layer from the map
    layers.forEach(layer => {
        layer.removeFrom(map);
    });
}










/*******************************************************************************************************
 * PLAYGROUND
 * Non-final code to test new features
 ******************************************************************************************************/


/**
 * Example code to draw some circles and lines onto Leaflet map using D3
 */

let svgLayer = L.svg();

// Draws some simple circles onto the map
function testD3Circles() {
    // Reset SVG layer if necessary
    if(map.hasLayer(svgLayer)) {
        resetSVGLayer();
    }

    // Add a svg layer to the map
    svgLayer = L.svg();
    svgLayer.addTo(map);

    // Create data for circles:
    var markers = [
        {long: 9.083, lat: 42.149}, // corsica
        {long: 7.26, lat: 43.71}, // nice
        {long: 2.349, lat: 48.864}, // Paris
        {long: -1.397, lat: 43.664}, // Hossegor
        {long: 3.075, lat: 50.640}, // Lille
        {long: -3.83, lat: 48}, // Morlaix
    ];

    // Select the svg area and add circles:
    d3.select("#map")
        .select("svg")
        .selectAll("myCircles")
        .data(markers)
        .enter()
        .append("circle")
        .attr("cx", function(d){ return map.latLngToLayerPoint([d.lat, d.long]).x })
        .attr("cy", function(d){ return map.latLngToLayerPoint([d.lat, d.long]).y })
        .attr("r", 14)
        .style("fill", "red")
        .attr("stroke", "red")
        .attr("stroke-width", 3)
        .attr("fill-opacity", .4);

    // If the user change the map (zoom or drag), I update circle position:
    map.on("moveend", update)
}

// Draws some simple lines onto the map
function testD3Lines() {
    // Reset SVG layer if necessary
    if(map.hasLayer(svgLayer)) {
        resetSVGLayer();
    }

    // Add a svg layer to the map
    svgLayer = L.svg();
    svgLayer.addTo(map);

    // Create data for lines:
    var lines = [{
        start: {
            long: 9.083, lat: 42.149
        },
        end: {
            long: 7.26, lat: 43.71
        }
    }, {
        start: {
            long: 2.349, lat: 48.864
        },
        end: {
            long: -1.397, lat: 43.664
        }
    },{
        start: {
            long: 3.075, lat: 50.640
        },
        end: {
            long: -3.83, lat: 48
        }
    }];

    // Select the svg area and add lines:
    d3.select("#map")
        .select("svg")
        .selectAll("line")
        .data(lines)
        .enter()
        .append("line")
        .attr("x1", function(d){ return map.latLngToLayerPoint([d.start.lat, d.start.long]).x })
        .attr("y1", function(d){ return map.latLngToLayerPoint([d.start.lat, d.start.long]).y })
        .attr("x2", function(d){ return map.latLngToLayerPoint([d.end.lat, d.end.long]).x })
        .attr("y2", function(d){ return map.latLngToLayerPoint([d.end.lat, d.end.long]).y })
        .attr("stroke", "red")
        .attr("stroke-width", 3);

    // If the user change the map (zoom or drag), I update circle position:
    map.on("moveend", update)
}

// Handles resetting the SVG layer. Should be called whenever new stuff is drawn to remove the old stuff
function resetSVGLayer() {
    svgLayer.removeFrom(map);
}

// Function that updates position when map view moved
function update() {
    // Update circles
    d3.selectAll("circle")
        .attr("cx", function(d){ return map.latLngToLayerPoint([d.lat, d.long]).x })
        .attr("cy", function(d){ return map.latLngToLayerPoint([d.lat, d.long]).y });

    // Update lines
    d3.selectAll("line")
        .attr("x1", function(d){ return map.latLngToLayerPoint([d.start.lat, d.start.long]).x })
        .attr("y1", function(d){ return map.latLngToLayerPoint([d.start.lat, d.start.long]).y })
        .attr("x2", function(d){ return map.latLngToLayerPoint([d.end.lat, d.end.long]).x })
        .attr("y2", function(d){ return map.latLngToLayerPoint([d.end.lat, d.end.long]).y })

}
