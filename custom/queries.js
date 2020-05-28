function query_allStations() {
    return `
    PREFIX geo:    <http://www.w3.org/2003/01/geo/wgs84_pos#>
    PREFIX swiss:  <https://ld.geo.admin.ch/>
     
    SELECT ?ID ?name ?lat ?lng {
        ?a a <http://vocab.gtfs.org/terms#Stop>.
        ?a <http://schema.org/name> ?name .
        ?a geo:lat ?lat .
        ?a geo:long ?lng .
        ?a <https://ld.geo.admin.ch/def/transportation/operatingPointType> ?Art
        
        BIND(STRAFTER(STR(?a), "stop/") AS ?ID)
    }`
}

function query_allStationsMatchingSearchTerms(searchTerms) {
    let filters = "";
    let searchTermList = searchTerms.split(" ");

    searchTermList.forEach(term => {
        filters += "FILTER(contains(lcase(?name), lcase(\"" + term + "\"))) "
    });

    return `
    PREFIX geo:    <http://www.w3.org/2003/01/geo/wgs84_pos#>
    PREFIX swiss:  <https://ld.geo.admin.ch/>
     
    SELECT ?ID ?name ?lat ?lng {
        ?a a <http://vocab.gtfs.org/terms#Stop>.
        ?a <http://schema.org/name> ?name .
        ?a geo:lat ?lat .
        ?a geo:long ?lng .
        ?a <https://ld.geo.admin.ch/def/transportation/operatingPointType> ?Art
        
        BIND(STRAFTER(STR(?a), "stop/") AS ?ID)
    
        ` + filters + `} ORDER BY ?name`
}

function query_allShortDistancesForStation(stationID) {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
    PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
    PREFIX unit: <http://qudt.org/vocab/unit#>
    SELECT ?name ?lat ?lng ?ID ?distance
    WHERE {
        ?Kante a otd:Relation;
               schema:departureStation ?departurePoint;
               schema:arrivalStation ?arrivalPoint.
        
        ?departurePoint rdfs:label ?departure;
                        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?departureCoord;
                        dcterms:identifier ?departureID .
        
        ?arrivalPoint rdfs:label ?name ;
                      <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?arrivalCoord;
                      dcterms:identifier ?arrivalID.
            
        FILTER(?departurePoint IN (<http://lod.opentransportdata.swiss/didok/` + stationID + `>))
    
        ?arrivalPoint geo:hasGeometry ?geom1;
                      rdfs:label ?startName;
                      dcterms:identifier ?startID .
      
        ?departurePoint geo:hasGeometry ?geom2 ;
                        rdfs:label ?endName;
                        dcterms:identifier ?endID .
      
        BIND(xsd:integer(geof:distance(?geom1, ?geom2, unit:Meter)) as ?distance) 
      
        BIND(REPLACE(STR(?arrivalCoord), "POINT\\\\(", "") AS ?tmpCoord)
        BIND(REPLACE(?tmpCoord, "\\\\)", "") AS ?tmpCoord2)
    
        BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
        BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)
  
        BIND(?arrivalID AS ?ID)
    } ORDER BY ?name
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

function query_ZoningPlanAllStations(zoningPlan) {
    return `
    PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
    PREFIX gtfs: <http://vocab.gtfs.org/terms#>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/> PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT ?Station ?Name ?Coord ?departureID
    WHERE {
    ?Kante a otd:Relation; otd:zoningPlan
    <` + zoningPlan + `>; schema:departureStation ?Station .
    ?Station rdfs:label ?Name ;
    <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;              dcterms:identifier ?departureID .
    } 
    `
}

function query_distanceOfAllShortDistances() {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    prefix geo: <http://www.opengis.net/ont/geosparql#>
    prefix geof: <http://www.opengis.net/def/function/geosparql/>
    prefix unit: <http://qudt.org/vocab/unit#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
     
    SELECT ?distance
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
      
      BIND(xsd:integer(geof:distance(?geom1, ?geom2, unit:Meter)) as ?distance)
    }
    `
}

function query_distanceOfZoningplanShortDistances(zoningPlan) {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    prefix geo: <http://www.opengis.net/ont/geosparql#>
    prefix geof: <http://www.opengis.net/def/function/geosparql/>
    prefix unit: <http://qudt.org/vocab/unit#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
     
    SELECT ?distance
    WHERE {
      ?Relation a otd:Relation;
           otd:zoningPlan <` + zoningPlan + `>;
           otd:routeType ?RouteType;
           schema:arrivalStation ?stop1 ;
           schema:departureStation ?stop2.
     
      ?stop1 geo:hasGeometry ?geom1 ;
           rdfs:label ?startName;
           dcterms:identifier ?startID .
     
      ?stop2 geo:hasGeometry ?geom2 ;
           rdfs:label ?endName;
           dcterms:identifier ?endID .
      
      BIND(xsd:integer(geof:distance(?geom1, ?geom2, unit:Meter)) as ?distance)
    }
    `
}

function query_IdOfAllStationsWithShortDistances() {
    return `
    PREFIX schema: <http://schema.org/>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT distinct ?ID
    WHERE {
        ?Kante a otd:Relation;
                 schema:departureStation ?departurePoint.
        ?departurePoint dcterms:identifier ?ID .
    }
    `
}
