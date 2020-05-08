function query_allStations() {
    return `
    PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT distinct ?ID ?Name ?lat ?lng
    WHERE {
        ?Station rdfs:label ?Name ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;
        FILTER(REGEX(STR(?Coord), 'POINT\\\\('))
        
        BIND(STRAFTER(STR(?Station), "didok/") AS ?ID)
        
        BIND(REPLACE(STR(?Coord), "POINT\\\\(", "") AS ?tmpCoord)
        BIND(REPLACE(?tmpCoord, "\\\\)", "") AS ?tmpCoord2)
      
        BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
        BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)
    } ORDER BY ?Name`
}

function query_allStationsLibero() {
    return `
    PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/> PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT distinct ?Station ?Name ?Coord ?departureID
    WHERE {
        ?Kante a otd:Relation; 
        otd:zoningPlan<http://lod.opentransportdata.swiss/zoningplan/libero/libero-billett-libero>;
        schema:departureStation ?Station .
        ?Station rdfs:label ?Name ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;              dcterms:identifier ?departureID .
    }
    limit 10000
    `
}

function query_allStationsMatchingSearchTerms(searchTerms) {
    let filters = "";
    let searchTermList = searchTerms.split(" ");

    searchTermList.forEach(term => {
        filters += "FILTER(contains(lcase(?Name), lcase(\"" + term + "\"))) "
    });

    return `
    PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT distinct ?ID ?Name ?lat ?lng
    WHERE {
        ?ID rdfs:label ?Name ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;
        
        BIND(REPLACE(STR(?Coord), "POINT\\\\(", "") AS ?tmpCoord)
        BIND(REPLACE(?tmpCoord, "\\\\)", "") AS ?tmpCoord2)
      
        BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
        BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)
    ` + filters + "} ORDER BY ?Name"
}


function query_allShortDistancesForStation(stationID) {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT ?arrival ?lat ?lng ?arrivalID
    WHERE {
        ?Kante a otd:Relation;
        schema:departureStation ?departurePoint;
        schema:arrivalStation ?arrivalPoint.
        ?departurePoint rdfs:label ?departure ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?departureCoord;
        dcterms:identifier ?departureID .
        ?arrivalPoint rdfs:label ?arrival ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?arrivalCoord;
        dcterms:identifier ?arrivalID.
        FILTER(?departurePoint IN (<http://lod.opentransportdata.swiss/didok/` + stationID + `>))
  
  		BIND(REPLACE(STR(?arrivalCoord), "POINT\\(", "") AS ?tmpCoord)
        BIND(REPLACE(?tmpCoord, "\\)", "") AS ?tmpCoord2)
      
        BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
        BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)
    }
    `
}

function query_50longestShortDistances() {
    return `
    PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
    PREFIX dcterm: <http://purl.org/dc/terms/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    prefix geo: <http://www.opengis.net/ont/geosparql#>
    prefix geof: <http://www.opengis.net/def/function/geosparql/>
    prefix unit: <http://qudt.org/vocab/unit#>
     
    SELECT ?startName ?startID ?startLat ?startLng ?endName ?endID ?endLat ?endLng ?distance
    WHERE {
     
      ?Relation a otd:Relation;
           otd:zoningPlan ?Zonenplan;
           otd:routeType ?RouteType;
           schema:arrivalStation ?stop1 ;
           schema:departureStation ?stop2.
     
      ?stop1 geo:hasGeometry ?geom1 ;
           rdfs:label ?startName;
           dcterms:identifier ?startID .
     
      ?stop2 geo:hasGeometry ?geom2 ;
           rdfs:label ?endName;
           dcterms:identifier ?endID .
     
      BIND(geof:distance(?geom1, ?geom2, unit:Meter) as ?distance)
     
      ?geom1 geo:asWKT ?loc1 .   
      ?geom2 geo:asWKT ?loc2 .
      
      BIND(REPLACE(STR(?loc1), "POINT\\\\(", "") AS ?tmpCoordStart1)
      BIND(REPLACE(?tmpCoordStart1, "\\\\)", "") AS ?tmpCoordStart2)   
      BIND(STRAFTER(?tmpCoordStart2, " ") AS ?startLat)
      BIND(STRBEFORE(?tmpCoordStart2, " ") AS ?startLng)
      
      BIND(REPLACE(STR(?loc2), "POINT\\\\(", "") AS ?tmpCoordEnd1)
      BIND(REPLACE(?tmpCoordEnd1, "\\\\)", "") AS ?tmpCoordEnd2)   
      BIND(STRAFTER(?tmpCoordEnd2, " ") AS ?endLat)
      BIND(STRBEFORE(?tmpCoordEnd2, " ") AS ?endLng)
    }
    ORDER BY DESC (?distance)
    LIMIT 50
    `
}

function query_shortDistanceCountByStation() {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT DISTINCT ?departure ?lat ?lng (count(?departureID) as ?count)
    WHERE {
        ?Kante a otd:Relation;
        schema:departureStation ?departurePoint.
        ?departurePoint rdfs:label ?departure ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?departureCoord;
        dcterms:identifier ?departureID.
        
        BIND(REPLACE(STR(?departureCoord), "POINT\\\\(", "") AS ?tmpCoord)
        BIND(REPLACE(?tmpCoord, "\\\\)", "") AS ?tmpCoord2)
      
        BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
        BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)
    } GROUP BY ?departure ?lat ?lng ORDER BY DESC(?count)
    `;
}

function query_allZoningplans() {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    prefix otd: <http://lod.opentransportdata.swiss/vocab/>


    SELECT ?Zonenplan ?namen 
    FROM <https://linked.opendata.swiss/graph/sbb/nova>
    WHERE {
    ?Zonenplan a otd:ZoningPlan; 
                rdfs:label     ?namen.

    }
    `
}

function query_ZoningPlanStations(zoningPlan) {
    return `
    PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/> PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT distinct ?Station ?Name ?Coord ?departureID
    WHERE {
    ?Kante a otd:Relation; otd:zoningPlan
    <` + zoningPlan + `>; schema:departureStation ?Station .
    ?Station rdfs:label ?Name ;
    <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;              dcterms:identifier ?departureID .
    } 
    `
}

//TODO, manipulate query
function query_allMonoDirectionalShortDistancesForStation() {
    return `
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT * WHERE {

    { SELECT ?startingPoint (COUNT(?Kante) AS ?kurzstreckeDeparture) WHERE {
        ?Kante a otd:Relation;
            otd:zoningPlan <http://lod.opentransportdata.swiss/zoningPlan/Libero/Libero%20Billett%20Libero>;
            schema:departureStation ?startingPoint ;
            schema:arrivalStation ?arrivalStation .
    } GROUP BY ?startingPoint
    }
    #  ?arrivalStation rdfs:label ?arrivalStationLabel .

    { SELECT (COUNT(?kante2) AS ?kurzstrecke2Departure) WHERE {
        ?kante2 a otd:Relation;
            otd:zoningPlan <http://lod.opentransportdata.swiss/zoningPlan/Libero/Libero%20Billett%20Libero>;
            schema:departureStation ?arrivalStation;
            schema:arrivalStation ?startingPoint .
    } GROUP BY ?startingPoint
    }
    #?kante2Kantenende rdfs:label ?kante2KantenendeLabel .

    FILTER( ?kurzstreckeDeparture != ?kurzstrecke2Departure)

    } 
    `
}

