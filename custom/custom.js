/*******************************************************************************************************
 * GLOBAL VARIABLES
 * Variables used throughout the application.
 ******************************************************************************************************/
// Endpoint URLs for SPARQL queries
const LINDAS_ENDPOINT = "https://lindas.admin.ch/query";
const GEOADMIN_ENDPOINT = "https://ld.geo.admin.ch/query";

// Name of currently selected sidebar element
let currentSidebarElement = "Welcome";

// List of station ID's that include at least one short distance
let stationsWithShortDistances = [];

// List of station ID's of all end stations of the currently displayed short distances
let stationIDsOfCurrentShortDistances = [];



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
    createZoningplanVisualization()
    createDistanceOfShortDistancesVisualization()
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

// Leaflet icon of default black/red marker icon but with a lighter color tone
const lightDefaultIcon = L.icon({
    iconUrl: 'assets/icons/marker-icon-light.png',
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
    map.on('moveend', updateSVGElements);
    map.on('zoomend', updateSVGElements);
    map.on('click', resetCurrentShortDistancesLayer);
    map.on('mouseover', () => { resetSVG("circle") });

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
 * Requests list of ID's of all stations with at least one short distance and stores them for later.
 * Overwrites icons for stations that include short distances with different icon to separate them visually on the map.
 */
function createClusterLayer() {
    // Add default cluster layer containing all stations
    clusterLayer = L.markerClusterGroup({
        maxClusterRadius: 150,
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: false
    });

    d3.sparql(GEOADMIN_ENDPOINT, query_allStations()).then(data => {
        data.forEach(station => {
            // Create marker (incl. tooltip) and add it to cluster layer
            markers[station.ID] = L.marker([station.lat, station.lng], { icon: lightDefaultIcon })
                .addTo(clusterLayer)
                .bindTooltip(station.name, { opacity: 1, direction: 'top', className: 'tooltip' })
                .on("click", () => { showCurrentShortDistances(station) });
        });

        // Requests a list of ID's of all stations with at least one short distance
        d3.sparql(LINDAS_ENDPOINT, query_IdOfAllStationsWithShortDistances()).then(data => {
            // Stores received data for later usage when new markers are created
            stationsWithShortDistances = data;

            // Overwrites lighter default icon for all markers that represent stations with at least one short distance
            data.forEach(station => {
                // Tries to update marker with darker default icon
                try { markers[station.ID].setIcon(defaultIcon) } catch { }
            });

            // Add cluster layer to map only if its sidebar section is still selected
            if (currentSidebarElement === "Welcome") {
                clusterLayer.addTo(map);
            }
        });
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

            // Add short distance as item to sidebar

            // Complete short distance item
            const shortDistanceItem = document.createElement("div");
            shortDistanceItem.classList.add("shortDistanceItem");

            // Small "VON" label
            const startButton = document.createElement("span");
            startButton.classList.add("label");
            startButton.innerHTML = "von";

            // Start station name
            const startStation = document.createElement("div");
            startStation.appendChild(startButton);
            startStation.innerHTML += shortDistance.startName;

            // Small "NACH" label
            const endButton = document.createElement("span");
            endButton.classList.add("label");
            endButton.innerHTML = "nach";

            // End station name
            const endStation = document.createElement("div");
            endStation.appendChild(endButton);
            endStation.innerHTML += shortDistance.endName;

            // Distance span
            const distance = document.createElement("span");
            distance.classList.add("distance");
            distance.innerHTML = (shortDistance.distance / 1000).toFixed(1) + " km";
            startStation.appendChild(distance);

            // Construct short distance item for sidebar by appending it
            document.getElementById("listOfLongestShortDistances").appendChild(shortDistanceItem);
            shortDistanceItem.appendChild(startStation);
            shortDistanceItem.appendChild(endStation);
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
//save Array locally, so data can be loaded in advance
let tooLongShortDistance;
let lengthIntervalShortDistance;
function createDistanceOfShortDistancesVisualization() {
    // Request list with length of each available short distance
    d3.sparql(LINDAS_ENDPOINT, query_distanceOfAllShortDistances()).then(data => {

        // Set up array with specific length intervals to count its number of short distance
        let lengthIntervals = {
            "0.0 < x < 0.5 km": 0,
            "0.5 < x < 1.0 km": 0,
            "1.0 < x < 1.5 km": 0,
            "1.5 < x": 0

            /**,
            "1.5 < x < 2.0 km": 0,
            "2.0 < x < 2.5 km": 0,
            "2.5 < x < 3.0 km": 0,
            "3.0 < x < 3.5 km": 0,
            
            "3.5 < x < 4.0 km": 0,
            "4.0 < x < 4.5 km": 0,
            "4.5 < x": 0
            */
        };

        // Assign each short distance to a group according to its length
        data.forEach(shortDistance => {
            // Distance of currently evaluated short distance
            const distance = shortDistance.distance;

            // Increase count of length interval based on length of current short distance
            if (distance < 500) {
                lengthIntervals["0.0 < x < 0.5 km"]++;
                return null;
            } else if (500 <= distance && distance < 1000) {
                lengthIntervals["0.5 < x < 1.0 km"]++;
                return null;
            } else if (1000 <= distance && distance < 1500) {
                lengthIntervals["1.0 < x < 1.5 km"]++;
                return null;
            } else if (1500 <= distance) {
                lengthIntervals["1.5 < x"]++;
                return null;
            } /**     else if (2000 <= distance && distance < 2500) {
                lengthIntervals["2.0 < x < 2.5 km"]++;
                return null;
            } else if (2500 <= distance && distance < 3000) {
                lengthIntervals["2.5 < x < 3.0 km"]++;
                return null;
            } else if (3000 <= distance && distance < 3500) {
                lengthIntervals["3.0 < x < 3.5 km"]++;
                return null;
            } else if (3500 <= distance

                           && distance < 4000) {
                                lengthIntervals["3.5 < x < 4.0 km"]++;
                                return null;
                            } else if (4000 <= distance && distance < 4500) {
                                lengthIntervals["4.0 < x < 4.5 km"]++;
                                return null;
                            } else if (4500 <= distance
            ) {
                //Changed Interval set
                lengthIntervals["3.5 < x"]++;
                return null;
            }*/
        });

        // Lower bound number of short distances which technically are too long (over 1.5 km)
        const tooLongShortDistancesCount = lengthIntervals["1.5 < x"]

        /*
            lengthIntervals["1.5 < x < 2.0 km"] +
            lengthIntervals["2.0 < x < 2.5 km"] +
            lengthIntervals["2.5 < x < 3.0 km"] +
            lengthIntervals["3.0 < x < 3.5 km"] +
            lengthIntervals["3.5 < x< 4.0 km"] +
        lengthIntervals["4.0 < x < 4.5 km"] +
        lengthIntervals["4.5 < x"];
        */
        // Lower bound percentage of how many short distances are technically too long
        percentageTooLong = (tooLongShortDistancesCount * 100 / data.length).toFixed(1);

        lengthIntervals["0.0 < x < 0.5 km"] = (lengthIntervals["0.0 < x < 0.5 km"] * 100 / data.length).toFixed(1);
        lengthIntervals["0.5 < x < 1.0 km"] = (lengthIntervals["0.5 < x < 1.0 km"] * 100 / data.length).toFixed(1);
        lengthIntervals["1.0 < x < 1.5 km"] = (lengthIntervals["1.0 < x < 1.5 km"] * 100 / data.length).toFixed(1);
        lengthIntervals["1.5 < x"] = (lengthIntervals["1.5 < x"] * 100 / data.length).toFixed(1);


        // TODO: Create visualization based on above data
        //save data into global variable

        tooLongShortDistance = percentageTooLong;
        console.log(percentageTooLong)
        lengthIntervalShortDistance = lengthIntervals;
    })
}

/**
 * Creates and sets up the 'Distance of Short Distances' visualization for each zoningplan.
 * Requests and processes all the data. Counts number of short distances between specific length intervals.
 * compared to overall number of short distances. Creates visualization based on given data and adds it to sidebar.
 */
let zoningPlanwithShortDistance = [];
function createZoningplanDistanceOfShortDistancesVisualization(station) {

    // Request list with length of each available short distance
    d3.sparql(LINDAS_ENDPOINT, query_distanceOfZoningplanShortDistances(station.Zonenplan)).then(data => {

        if (station.namen === "Léman Pass Abo &amp; Billett") {
            station.namen = "Léman Pass Abo"
            console.log(station.namen)

        }

        if (station.namen === "A-Welle Abo &amp; Billett") {
            station.namen = "A-Welle Abo  Billett"
            console.log(station.namen)

        }

        // Set up array with specific length intervals to count its number of short distance
        let lengthIntervals = {
            "Zoningplan": station.namen,
            "0.0 < x < 0.5 km": 0,
            "0.5 < x < 1.0 km": 0,
            "1.0 < x < 1.5 km": 0,
            "1.5 < x": 0
        };

        // Assign each short distance to a group according to its length
        data.forEach(shortDistance => {
            // Distance of currently evaluated short distance
            const distance = shortDistance.distance;

            // Increase count of length interval based on length of current short distance
            if (distance < 500) {
                lengthIntervals["0.0 < x < 0.5 km"]++;
                return null;
            } else if (500 <= distance && distance < 1000) {
                lengthIntervals["0.5 < x < 1.0 km"]++;
                return null;
            } else if (1000 <= distance && distance < 1500) {
                lengthIntervals["1.0 < x < 1.5 km"]++;
                return null;
            } else if (1500 <= distance) {
                lengthIntervals["1.5 < x"]++;
                return null;
            }
        });

        const zoningPlanwithShortDistanceLength = lengthIntervals["0.0 < x < 0.5 km"] +
            lengthIntervals["0.5 < x < 1.0 km"] +
            lengthIntervals["1.0 < x < 1.5 km"] +
            lengthIntervals["1.5 < x"]

        //Define data as percentage
        lengthIntervals["0.0 < x < 0.5 km"] = (lengthIntervals["0.0 < x < 0.5 km"] * 100 / data.length).toFixed(1);
        lengthIntervals["0.5 < x < 1.0 km"] = (lengthIntervals["0.5 < x < 1.0 km"] * 100 / data.length).toFixed(1);
        lengthIntervals["1.0 < x < 1.5 km"] = (lengthIntervals["1.0 < x < 1.5 km"] * 100 / data.length).toFixed(1);
        lengthIntervals["1.5 < x"] = (lengthIntervals["1.5 < x"] * 100 / data.length).toFixed(1);



        //Currently 12 Zoningplans with short distances
        if (zoningPlanwithShortDistanceLength > 0) {
            zoningPlanwithShortDistance.push(lengthIntervals)

            console.log(lengthIntervals)
        }
        //TODO Array
        //lengthIntervalShortDistance = lengthIntervals;
    })
}


/**
 * Shows all short distances of the given station. Adds end point and connecting lines to 'currentShortDistancesLayer'.
 * Clears any markers and lines on this layer from any previous station before adding new ones from current station.
 * Requests and processes all the data. Clicking on end point displays short distances of this station.
 * End points are styled differently with alternative icon and lines change style on hover.
 * Displays short distance data in station overview box. Plays fly animation to bounds of all short distances.
 *
 * @param station                 Station of which the short distances get displayed
 */
function showCurrentShortDistances(station) {
    d3.sparql(LINDAS_ENDPOINT, query_allShortDistancesForStation(station.ID)).then((data) => {
        resetCurrentShortDistancesLayer();

        // Display number of short distances in station overview box
        document.getElementById("shortDistance-count").innerHTML =
            (data.length === 0) ? "Keine Kurzstrecken verfügbar" : (data.length + " Kurzstrecken verfügbar nach:");

        // Variables to calculate bounds of short distance stations for flyTo-animation
        // Uses departure station coordinates as starting values
        let latMin = station.lat, latMax = station.lat, lngMin = station.lng, lngMax = station.lng;

        data.forEach(shortDistance => {
            // Remove existing markers of about to be displayed end stations from the map (incl. markerCluster and searchResult layers)
            try { markers[shortDistance.ID].removeFrom(clusterLayer) } catch { }
            try { searchResultMarkers[shortDistance.ID].removeFrom(searchResultsLayer) } catch { }
            // Store which markers were removed in array to recover them afterwards
            stationIDsOfCurrentShortDistances.push(shortDistance.ID);

            // Set lat/lng of arrival station coordinate of current short distance as new min/max if it is
            if (parseFloat(shortDistance.lat) < latMin) latMin = parseFloat(shortDistance.lat);
            if (parseFloat(shortDistance.lat) > latMax) latMax = parseFloat(shortDistance.lat);
            if (parseFloat(shortDistance.lng) < lngMin) lngMin = parseFloat(shortDistance.lng);
            if (parseFloat(shortDistance.lng) > lngMax) lngMax = parseFloat(shortDistance.lng);

            L.marker([shortDistance.lat, shortDistance.lng], { icon: alternativeIcon, forceZIndex: 1000 })
                .addTo(currentShortDistancesLayer)
                .bindTooltip(shortDistance.name, { opacity: 1, direction: 'top', className: 'tooltip' })
                .on("click", () => { console.log(station); showCurrentShortDistances(shortDistance) });

            let polyline = L.polyline([[station.lat, station.lng], [shortDistance.lat, shortDistance.lng]], { color: 'black', weight: 2 })
                .addTo(currentShortDistancesLayer)
                .on('mouseover', () => { polyline.setStyle({ color: 'red', weight: 5 }) })
                .on('mouseout', () => { polyline.setStyle({ color: 'black', weight: 2 }) });

            // Create div-element for each short distance and add ID, CSS class and HTML content
            const shortDistanceDiv = document.createElement("div");
            shortDistanceDiv.id = "shortDistance-" + shortDistance.ID;
            shortDistanceDiv.classList.add("shortDistanceItem");
            shortDistanceDiv.innerHTML = shortDistance.name;
            // Add click event to show short distances of clicked station
            shortDistanceDiv.addEventListener("click", () => {
                showCurrentShortDistances(shortDistance);
            });

            // Create span-element for each short distance with its length and add CSS class and HTML content
            const shortDistanceSpan = document.createElement("span");
            shortDistanceSpan.classList.add("distance");
            shortDistanceSpan.innerHTML = (shortDistance.distance / 1000).toFixed(1) + " km"; // Rounded to .1
            // Append created span-element to its related shortDistanceDiv
            shortDistanceDiv.appendChild(shortDistanceSpan);
            // Add mouseover event to display circle around search result marker on map
            shortDistanceDiv.addEventListener("mouseover", () => {
                highlightSpot(shortDistance);
            });
            // Add mouseout event to remove circle from map
            shortDistanceDiv.addEventListener("mouseout", () => {
                resetSVG("circle");
            });

            // Append created div-element to DOM to make it visible
            document.getElementById("stationOverview-shortDistances").appendChild(shortDistanceDiv);
        });

        // Display station name in station overview box
        document.getElementById("stationOverview-name").innerHTML = station.name;

        // Set href link of station overview name to redirect to Search page of current station
        document.getElementById("searchLink").href = "https://fahrplan.search.ch/" + station.ID;

        // Display station overview box
        document.getElementById("stationOverview").classList.remove("hidden");

        // Play fly animation to bounds containing departure station and arrival station of all short distances
        map.flyToBounds([
            [latMin, lngMin],
            [latMax, lngMax]
        ]);
    });
}

/**
 * Resets the layer that displays the short distances of the currently selected station by removing all markers and lines.
 */
function resetCurrentShortDistancesLayer() {
    // Re-add previously removed markers to markerCluster and searchResult layers
    stationIDsOfCurrentShortDistances.forEach(ID => {
        try { markers[ID].addTo(clusterLayer) } catch { }
        try { searchResultMarkers[ID].addTo(searchResultsLayer) } catch { }
    });
    // Reset array since all markers have been re-added to corresponding layer
    stationIDsOfCurrentShortDistances = [];

    // Hide station overview box
    document.getElementById("stationOverview").classList.add("hidden");

    // Remove all short distances from station overview box
    document.getElementById("stationOverview-shortDistances").innerHTML = "";

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
 * Highlights the given spots by drawing a circle at its coordinates. The provided data is an array of elements which
 * all must include a 'lat' and 'lng' property in order to calculate its layer point to draw the circle onto the map.
 *
 * @param spotData                Data including coordinates of spot to be highlighted
 */
function highlightSpot(spotData) {
    // Remove any previous circles from the map
    resetSVG("circle");

    // Set up the SVG layer
    if (map.hasLayer(svgCircles)) {
        svgCircles.removeFrom(map);
    }
    svgCircles = L.svg();
    svgCircles.addTo(map);

    // Draw circle at given coordinate
    d3.select("#map")
        .select("svg")
        .selectAll("circles")
        .data([spotData])
        .enter()
        .append("circle")
        .attr("cx", (d) => { return latLngToX(d.lat, d.lng) })
        .attr("cy", (d) => { return latLngToY(d.lat, d.lng) })
        .attr("r", 14)
        .attr("fill", "#398CF7")
        .attr("fill-opacity", 0.95)
        .attr("stroke", "#FFFFFF")
        .attr("stroke-width", 5);
}

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
    switch (resetCase) {
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
 * Display Number of Stations per zoningplan
 * Creates Zoningplan Visualization
 * Prepares data for Bar Chart for each zoningplan
 */


function createZoningplanVisualization() {


    d3.sparql(LINDAS_ENDPOINT, query_allZoningplans()).then((data) => {

        zoningplanArray = []
        zoningplanAllArray = []

        data.forEach(station => {
            createZoningplanDistanceOfShortDistancesVisualization(station),


                d3.sparql(LINDAS_ENDPOINT, query_ZoningPlanStations(station.Zonenplan)).then((d) => {

                    if (d.length > 0) {
                        zoningplanArray.push({ "label": station.namen, "count": d.length });
                    }
                },


                ),
                d3.sparql(LINDAS_ENDPOINT, query_ZoningPlanAllStations(station.Zonenplan)).then((d) => {

                    if (d.length > 0) {
                        zoningplanAllArray.push({ "label": station.namen, "count": d.length });
                    }
                    console.log(zoningplanAllArray);
                },
                );
        },
        );
    })
}



/*******************************************************************************************************
 * SEARCH
 * Functions and variables related to the 'Search' section in the sidebar.
 ******************************************************************************************************/

// List of Leaflet markers that contains all stations matching the current search terms
let searchResultMarkers;

/**
 * Displays all markers that match the user's search terms on the map. Updates search results in sidebar section.
 * Plays fly animation that sets the view to the bounds containing all search result markers.
 */
function showMatchingStations() {
    // Get user's search terms from input field
    let searchTerms = document.getElementById("searchTerms").value;

    // Reset list of search result markers
    searchResultMarkers = [];

    // Remove any previous search results from map and sidebar section
    try { map.removeLayer(searchResultsLayer); } catch { }
    document.getElementById("searchResults").innerHTML = "";

    // If the search terms are too short (below 3 characters), the search gets cancelled and message gets displayed
    if (searchTerms.length < 3) {
        document.getElementById("searchResults").innerHTML = "Bitte geben Sie mind. 3 Zeichen ein";
        return;
    }

    // Request all stations matching user's search terms
    d3.sparql(GEOADMIN_ENDPOINT, query_allStationsMatchingSearchTerms(searchTerms)).then((rawData) => {

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

            // Create div-element for each search result and add ID, CSS class and HTML content
            const searchResultDiv = document.createElement("div");
            searchResultDiv.id = "searchResult-" + station.ID;
            searchResultDiv.classList.add("searchItem");
            searchResultDiv.innerHTML = station.name;
            // Add click event to show short distances of search result
            searchResultDiv.addEventListener("click", () => {
                showCurrentShortDistances(station);
            });
            // Add mouseover event to display circle around search result marker on map
            searchResultDiv.addEventListener("mouseover", () => {
                highlightSpot(station);
            });
            // Add mouseout event to remove circle from map
            searchResultDiv.addEventListener("mouseout", () => {
                resetSVG("circle");
            });

            // Append created div-element to DOM to make it visible
            document.getElementById("searchResults").appendChild(searchResultDiv);

            // Add station as marker to both search results layer/array and bind popup with station name
            searchResultMarkers[station.ID] = L.marker([station.lat, station.lng], { icon: lightDefaultIcon })
                .addTo(searchResultsLayer)
                .bindTooltip(station.name, { opacity: 1, direction: 'top', className: 'tooltip' })
                .on("click", () => { showCurrentShortDistances(station) });
        });

        // Overwrites lighter default icon for all markers that represent stations with at least one short distance
        stationsWithShortDistances.forEach(station => {
            // Tries to update marker with darker default icon if it exists in search results array
            try { searchResultMarkers[station.ID].setIcon(defaultIcon) } catch { }
        });

        // Add layer containing all search result markers to map
        searchResultsLayer.addTo(map);

        // Play fly animation to bounds containing all search result markers
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
    // List of sidebar section names
    let sectionNames = ["LongestShortDistance", "ShortDistanceDistribution", "LengthShortDistanceByZoningPlan", "StationsWithShortDistancesPerZoningPlan", "ShortDistancesPerZoningPlan"];

    // Hide content of all sidebar elements and deselect all menu buttons
    sectionNames.forEach(sectionName => {
        document.getElementById("analyze" + sectionName).classList.add("hidden");
    });

    // List of layers to be removed
    const layers = [heatmapLayer, longestShortDistanceLayer];

    // Remove each layer from the map
    layers.forEach(layer => {
        layer.removeFrom(map);
    });

    // Add selected layer back to map
    switch (event.target.value) {
        case ("longestShortDistance"):
            document.getElementById("analyzeLongestShortDistance").classList.remove("hidden");
            longestShortDistanceLayer.addTo(map);
            currentAnalyseLayer = longestShortDistanceLayer;
            break;
        case ("shortDistanceDistribution"):
            document.getElementById("analyzeShortDistanceDistribution").classList.remove("hidden");
            heatmapLayer.addTo(map);
            currentAnalyseLayer = heatmapLayer;
            break;
        case ("lengthShortDistanceByZoningPlan"):
            document.getElementById("analyzeLengthShortDistanceByZoningPlan").classList.remove("hidden");
            //createZoningplanVisualization()
            // Create Bar Chart for createDistanceOfShortDistancesVisualization
            console.log(lengthIntervalShortDistance["0.0 < x < 0.5 km"]);
            console.log(lengthIntervalShortDistance["0.5 < x < 1.0 km"]);
            console.log(lengthIntervalShortDistance["1.0 < x < 1.5 km"]);
            console.log(lengthIntervalShortDistance["1.5 < x"]);
            barchart(lengthIntervalShortDistance);
            break;
        case ("stationsWithShortDistancesPerZoningPlan"):
            document.getElementById("analyzeStationsWithShortDistancesPerZoningPlan").classList.remove("hidden");
            piechart(zoningplanArray)
            break;
        case ("shortDistancesPerZoningPlan"):
            document.getElementById("analyzeShortDistancesPerZoningPlan").classList.remove("hidden");
            piechart(zoningplanAllArray)
            break;
    }
}



function piechart(data) {

    console.log(zoningplanArray);


    var width = 300;
    var height = 600;

    var radius = Math.min(width, height) / 2;

    var color = d3.scaleOrdinal(d3.schemeCategory20);

    var svg = d3.select("#piechart").append("svg")
        .attr("width", width)
        .attr("height", height);

    var g = svg.append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 4) + ")")
        .attr("class", "chartGroup");

    var g2 = svg.append("g")
        .attr("transform", "translate(" + (30) + "," + ((400)) + ")")
        .attr("class", "chartGroup");

    var donutWidth = (width / 4);

    var arc = d3.arc()
        .innerRadius(donutWidth)
        .outerRadius(radius);

    var pie = d3.pie()
        .value(function (d) { return d.count })
        .sort(null);

    var tooltip = d3.select('#piechart')
        .append('div')
        .attr('class', 'pietooltip')

    tooltip.append('div')
        .attr('class', 'label');
    tooltip.append('div')
        .attr('class', 'count');
    tooltip.append('div')
        .attr('class', 'percent');


    //set data to Array with Number of short distances per zoning plan
    dataset = data

    dataset.forEach(function (d) {
        d.count = +d.count;
        d.enabled = true;
    });

    var path = g.selectAll('path')
        .data(pie(dataset))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', function (d, i) {
            return color(d.data.label);
        })
        .each(function (d) { this._current = d; });

    path.on('mousemove', function (d) {
        var xposSub = document.getElementById("piechart").getBoundingClientRect().left;
        var xpos = d3.event.x - xposSub + 20
        var ypos = d3.event.y - 150
        tooltip.style("left", xpos + "px")
        tooltip.style("top", ypos + "px")
        var total = d3.sum(dataset.map(function (d) {
            return (d.enabled) ? d.count : 0;
        }));
        var percent = Math.round(10000 * d.data.count / total) / 100;
        tooltip.
            select('.label').html(d.data.label);
        tooltip.select('.count').html("Anzahl: " + d.data.count);
        tooltip.select('.percent').html(percent + '%');
        tooltip.style('display', 'block');
    });



    path.on('mouseout', function (d) {
        tooltip.style('display', 'none');

    });

    var legendRectSize = 8;
    var legendSpacing = 8;

    var legend = g2.selectAll('.legend')
        .data(color.domain())
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', function (d, i) {
            var height = legendRectSize + legendSpacing;
            var offset = height * color.domain().length / 2;
            var horz = -2 * legendRectSize;
            var vert = i * height - offset;
            return 'translate(' + horz + ',' + vert + ')';
        });

    legend.append('rect')
        .attr('width', legendRectSize)
        .attr('height', legendRectSize)
        .style('fill', color)
        .style('stroke', color)

        .on('click', function (label) {
            var rect = d3.select(this);
            var enabled = true;
            var totalEnabled = d3.sum(dataset.map(function (d) {
                return (d.enabled) ? 1 : 0;
            }));

            if (rect.attr('class') === 'disabled') {
                rect.attr('class', '');
            } else {
                if (totalEnabled < 2) return;
                rect.attr('class', 'disabled');
                enabled = false;
            }

            pie.value(function (d) {
                if (d.label === label) d.enabled = enabled;
                return (d.enabled) ? d.count : 0;
            });

            path = path.data(pie(dataset));

            path.transition()
                .duration(750)
                .attrTween('d', function (d) {
                    var interpolate = d3.interpolate(this._current, d);
                    this._current = interpolate(0);
                    return function (t) {
                        return arc(interpolate(t));
                    };
                });
        });


    legend.append('text')
        .attr('x', legendRectSize + legendSpacing)
        .attr('y', legendRectSize - legendSpacing)
        .attr('style', 'font-size: 12')
        .attr('alignment-baseline', 'middle')
        .text(function (d) { return d; });

}



function barchart(shortDistanceInterval) {
    document.getElementById("tooLongPlaceholder").innerText = tooLongShortDistance;

    document.getElementsByClassName("chart").innerHTML = shortDistanceInterval;


    var data = shortDistanceInterval

    //Define 4 Intervallbounds
    var i1 = '0.0 < x < 0.5 km'
    var i2 = '0.5 < x < 1.0 km'
    var i3 = '1.0 < x < 1.5 km'
    var i4 = '1.5 < x'

    var data = {
        labels: [
            'Total',
            zoningPlanwithShortDistance[0].Zoningplan,
            zoningPlanwithShortDistance[1].Zoningplan,
            zoningPlanwithShortDistance[2].Zoningplan,
            zoningPlanwithShortDistance[3].Zoningplan,
            zoningPlanwithShortDistance[4].Zoningplan,
            zoningPlanwithShortDistance[5].Zoningplan,
            zoningPlanwithShortDistance[6].Zoningplan,
            zoningPlanwithShortDistance[7].Zoningplan,
            zoningPlanwithShortDistance[8].Zoningplan,
            zoningPlanwithShortDistance[9].Zoningplan,
            zoningPlanwithShortDistance[10].Zoningplan
        ],
        series: [
            {

                label: "0.0-0.5km",
                values:
                    [
                        shortDistanceInterval[i1],
                        zoningPlanwithShortDistance[0][i1],
                        zoningPlanwithShortDistance[1][i1],
                        zoningPlanwithShortDistance[2][i1],
                        zoningPlanwithShortDistance[3][i1],
                        zoningPlanwithShortDistance[4][i1],
                        zoningPlanwithShortDistance[5][i1],
                        zoningPlanwithShortDistance[6][i1],
                        zoningPlanwithShortDistance[7][i1],
                        zoningPlanwithShortDistance[8][i1],
                        zoningPlanwithShortDistance[9][i1],
                        zoningPlanwithShortDistance[10][i1]
                    ]
            },
            {
                label: "0.5-1.0km",
                values:
                    [
                        shortDistanceInterval[i2],
                        zoningPlanwithShortDistance[0][i2],
                        zoningPlanwithShortDistance[1][i2],
                        zoningPlanwithShortDistance[2][i2],
                        zoningPlanwithShortDistance[3][i2],
                        zoningPlanwithShortDistance[4][i2],
                        zoningPlanwithShortDistance[5][i2],
                        zoningPlanwithShortDistance[6][i2],
                        zoningPlanwithShortDistance[7][i2],
                        zoningPlanwithShortDistance[8][i2],
                        zoningPlanwithShortDistance[9][i2],
                        zoningPlanwithShortDistance[10][i2]
                    ]
            },
            {
                label: "1.0-1.5km",
                values:
                    [
                        shortDistanceInterval[i3],
                        zoningPlanwithShortDistance[0][i3],
                        zoningPlanwithShortDistance[1][i3],
                        zoningPlanwithShortDistance[2][i3],
                        zoningPlanwithShortDistance[3][i3],
                        zoningPlanwithShortDistance[4][i3],
                        zoningPlanwithShortDistance[5][i3],
                        zoningPlanwithShortDistance[6][i3],
                        zoningPlanwithShortDistance[7][i3],
                        zoningPlanwithShortDistance[8][i3],
                        zoningPlanwithShortDistance[9][i3],
                        zoningPlanwithShortDistance[10][i3]]
            },
            {
                label: ">1.5km",
                values:
                    [
                        shortDistanceInterval[i4],
                        zoningPlanwithShortDistance[0][i4],
                        zoningPlanwithShortDistance[1][i4],
                        zoningPlanwithShortDistance[2][i4],
                        zoningPlanwithShortDistance[3][i],
                        zoningPlanwithShortDistance[4][i4],
                        zoningPlanwithShortDistance[5][i4],
                        zoningPlanwithShortDistance[6][i4],
                        zoningPlanwithShortDistance[7][i4],
                        zoningPlanwithShortDistance[8][i4],
                        zoningPlanwithShortDistance[9][i4],
                        zoningPlanwithShortDistance[10][i4]
                    ]
            },]
    };


    var chartWidth = 20,
        barHeight = 13,
        groupHeight = barHeight * data.series.length,
        gapBetweenGroups = 10,
        spaceForLabels = 150,
        spaceForLegend = 150;

    // Zip the series data together (first values, second values, etc.)
    var zippedData = [];
    for (var i = 0; i < data.labels.length; i++) {
        for (var j = 0; j < data.series.length; j++) {
            zippedData.push(data.series[j].values[i]);
        }
    }
    console.log(zippedData)

    // Color scale
    var color = d3.scaleOrdinal(d3.schemeCategory10);
    var chartHeight = barHeight * zippedData.length + gapBetweenGroups * data.labels.length + 50;

    var x = d3.scaleLinear()
        .domain([0, d3.max(zippedData)])
        .range([0, chartWidth]);

    var y = d3.scaleLinear()
        .range([chartHeight + gapBetweenGroups, 0]);

    var yAxis = d3.axisLeft(y)
        .tickFormat('')
        .tickSize(0);

    // Specify the chart area and dimensions
    var chart = d3
        .select(".chart")
        .attr("width", spaceForLabels + chartWidth + spaceForLegend)
        .attr("height", chartHeight);

    // Create bars
    var bar = chart.selectAll("g")
        .data(zippedData)
        .enter().append("g")
        .attr("transform", function (d, i) {
            return "translate(" + spaceForLabels + "," + (i * barHeight + gapBetweenGroups * (0.5 + Math.floor(i / data.series.length))) + ")";
        });

    // Create rectangles of the correct width
    bar.append("rect")
        .attr("fill", function (d, i) { return color(i % data.series.length); })
        .attr("class", "bar")
        .attr("width", x)
        .attr("height", barHeight - 1);

    // Add text label in bar
    bar.append("text")
        .attr("x", function (d) { return x(d) - 3; })
        .attr("y", barHeight / 2)
        .attr("fill", "red")
        .attr("dy", ".35em")
        .text(function (d) { return d + "%"; });

    // Draw labels
    bar.append("text")
        .attr("class", "label")
        .attr("x", function (d) { return - 10; })
        .attr("y", groupHeight / 2)
        .attr("dy", ".35em")
        .text(function (d, i) {
            if (i % data.series.length === 0)
                return data.labels[Math.floor(i / data.series.length)].replace("&amp;", "&");
            else
                return ""
        });

    chart.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + spaceForLabels + ", " + -gapBetweenGroups / 2 + ")")
        .call(yAxis);

    // Draw legend
    var legendRectSize = 12,
        legendSpacing = 2;

    var legend = chart.selectAll('.legend')
        .data(data.series)
        .enter()
        .append('g')
        .attr('transform', function (d, i) {
            var height = legendRectSize + legendSpacing;
            var offset = -gapBetweenGroups / 2;
            var horz = spaceForLabels + chartWidth + 110 - legendRectSize;
            var vert = i * height - offset;
            return 'translate(' + 0 + ',' + vert + ')';
        });

    legend.append('rect')
        .attr('width', legendRectSize)
        .attr('height', legendRectSize)
        .style('fill', function (d, i) { return color(i); })
        .style('stroke', function (d, i) { return color(i); });

    legend.append('text')
        .attr('class', 'legend')
        .attr('x', legendRectSize + legendSpacing)
        .attr('y', legendRectSize - legendSpacing)
        .text(function (d) { return d.label; });
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
    let sidebarCList = document.getElementById("sidebar").classList;
    sidebarOpen ? sidebarCList.add("closed") : sidebarCList.remove("closed");

    let mapCList = document.getElementById("map").classList;
    sidebarOpen ? mapCList.add("closed") : mapCList.remove("closed");

    sidebarOpen = !sidebarOpen;

    // Add interval to repeatedly adjust map view while sidebar is toggled
    const readjustMap = setInterval(() => {
        map.invalidateSize()
    }, 5);

    // Remove interval of readjusting map once transition is over
    setTimeout(() => {
        clearInterval(readjustMap)
    }, 500);
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
            resetCurrentShortDistancesLayer();
            clusterLayer.addTo(map);
            break;
        case ("Search"):
            removeAllLayers();
            resetCurrentShortDistancesLayer();
            searchResultsLayer.addTo(map);
            break;
        case ("Distance"):
            removeAllLayers();
            resetCurrentShortDistancesLayer();
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

/**
 * Removes the station overview from the map by hiding it. Gets called when the user clicks the cross to close it.
 */
function closeStationOverview() {
    document.getElementById("stationOverview").classList.add("hidden");
}
