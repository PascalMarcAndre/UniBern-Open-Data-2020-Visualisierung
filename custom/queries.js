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

function query_100longestRoutes() {
    return `
    
    `
}