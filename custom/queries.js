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
    SELECT distinct ?Station ?Name ?Coord
    WHERE {
        ?Station rdfs:label ?Name ;
        <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;
    
    ` + filters + "}"
}

function query_100longestShortDistances() {
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
     
    SELECT *
    #?Relation ?Zonenplan ?stNam1 ?stNam2 ?distance
    WHERE {
     
      ?Relation a otd:Relation;
           otd:zoningPlan ?Zonenplan;
           otd:routeType ?RouteType;
           schema:arrivalStation ?stop1 ;
          schema:departureStation ?stop2.
     
      ?stop1 geo:hasGeometry ?geom1 ;
             rdfs:label ?stNam1;
             dcterms:identifier ?didok1 .
     
      ?stop2 geo:hasGeometry ?geom2 ;
              rdfs:label ?stNam2;
             dcterms:identifier ?didok2 .
     
      BIND(geof:distance(?geom1, ?geom2, unit:Meter) as ?distance)
     
      
      ?geom1 geo:asWKT ?loc1 .   
      ?geom2 geo:asWKT ?loc2 .
     
      BIND(CONCAT("Connection ", ?stNam1, " - ", ?stNam2, "/", STR(?distance),"m") AS ?loc1Label)
      BIND( ?loc1Label AS ?loc2Label)
     
      BIND(STRDT(concat("LINESTRING ",strafter(strbefore(str(?loc1),")"),"POINT"), ",", strafter(str(?loc2),"POINT(")), <http://www.opengis.net/ont/geosparql#wktLiteral> )  as ?line)
     
     
     FILTER (?RouteType="KURZ"^^xsd:string)
     
    }
    ORDER BY DESC (?distance)
    LIMIT 100
    `
}