# Query Overview
This document contains all available SPARQL queries that we use in this project.  
Queries can be run under the following URL (unless otherwise stated) : [https://lindas.admin.ch/sparql/](https://lindas.admin.ch/sparql/)



### All Stations
Returns `id`, `name`, `lat`, `lng` of all stations.  
**Required endpoint:** [https://ld.geo.admin.ch/query](https://ld.geo.admin.ch/query)

````
PREFIX geo:    <http://www.w3.org/2003/01/geo/wgs84_pos#>
PREFIX swiss:  <https://ld.geo.admin.ch/>
 
SELECT ?id ?name ?lat ?lng {
  ?a a <http://vocab.gtfs.org/terms#Stop>.
  ?a <http://schema.org/name> ?name .
  ?a geo:lat ?lat .
  ?a geo:long ?lng .
  ?a <https://ld.geo.admin.ch/def/transportation/operatingPointType> ?Art
  
  BIND(STRAFTER(STR(?a), "stop/") AS ?id)
}
````



### All Stations Matching Search Terms
Returns `id`, `name`, `lat`, `lng` of all stations matching a list of search terms. The search is not case sensitive.  
*Query Example:* All stations containing `Thun` and `Bahnhof`.  
**Required endpoint:** [https://ld.geo.admin.ch/query](https://ld.geo.admin.ch/query)

````
PREFIX geo:    <http://www.w3.org/2003/01/geo/wgs84_pos#>
PREFIX swiss:  <https://ld.geo.admin.ch/>
 
SELECT ?id ?name ?lat ?lng {
  ?a a <http://vocab.gtfs.org/terms#Stop>.
  ?a <http://schema.org/name> ?name .
  ?a geo:lat ?lat .
  ?a geo:long ?lng .
  ?a <https://ld.geo.admin.ch/def/transportation/operatingPointType> ?Art
  
  BIND(STRAFTER(STR(?a), "stop/") AS ?id)

  FILTER(contains(lcase(?name), lcase("Thun")))
  FILTER(contains(lcase(?name), lcase("Bahnhof")))
}
````



### 50 Longest Short Distances
Returns `startName`, `startId`, `startLat`, `startLng`, `endName`, `endId`, `endLat`, `endLng`, `distance` of the
50 longest short distances ordered by descending length.

````
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
PREFIX unit: <http://qudt.org/vocab/unit#>
 
SELECT ?startName ?startId ?startLat ?startLng ?endName ?endId ?endLat ?endLng ?distance
WHERE {
 
  ?Relation a otd:Relation;
            otd:zoningPlan ?Zonenplan;
            otd:routeType ?RouteType;
            schema:arrivalStation ?stop1 ;
            schema:departureStation ?stop2.
 
  ?stop1 geo:hasGeometry ?geom1;
         rdfs:label ?startName;
         dcterms:identifier ?startId .
 
  ?stop2 geo:hasGeometry ?geom2;
         rdfs:label ?endName;
         dcterms:identifier ?endId .
 
  BIND(geof:distance(?geom1, ?geom2, unit:Meter) as ?distance)
 
  ?geom1 geo:asWKT ?loc1 .   
  ?geom2 geo:asWKT ?loc2 .
  
  BIND(REPLACE(STR(?loc1), "POINT\\(", "") AS ?tmpCoordStart1)
  BIND(REPLACE(?tmpCoordStart1, "\\)", "") AS ?tmpCoordStart2)   
  BIND(STRAFTER(?tmpCoordStart2, " ") AS ?startLat)
  BIND(STRBEFORE(?tmpCoordStart2, " ") AS ?startLng)
  
  BIND(REPLACE(STR(?loc2), "POINT\\(", "") AS ?tmpCoordEnd1)
  BIND(REPLACE(?tmpCoordEnd1, "\\)", "") AS ?tmpCoordEnd2)   
  BIND(STRAFTER(?tmpCoordEnd2, " ") AS ?endLat)
  BIND(STRBEFORE(?tmpCoordEnd2, " ") AS ?endLng)
}
ORDER BY DESC (?distance)
LIMIT 50
````


### All Short Distances from specified Station
Returns `name`, `lat`, `lng`, `id`, `distance` of arrival station of all short distances departing from specified station
ordered by ascending name.  
*Query Example:* All short distances from `8503000` (Zürich HB).

````
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
PREFIX unit: <http://qudt.org/vocab/unit#>

SELECT ?name ?lat ?lng ?id ?distance
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
      
  FILTER(?departurePoint IN (<http://lod.opentransportdata.swiss/didok/8503000>))

  ?arrivalPoint geo:hasGeometry ?geom1;
                rdfs:label ?startName;
                dcterms:identifier ?startID .

  ?departurePoint geo:hasGeometry ?geom2 ;
                  rdfs:label ?endName;
                  dcterms:identifier ?endID .

  BIND(xsd:integer(geof:distance(?geom1, ?geom2, unit:Meter)) as ?distance) 

  BIND(REPLACE(STR(?arrivalCoord), "POINT\\(", "") AS ?tmpCoord)
  BIND(REPLACE(?tmpCoord, "\\)", "") AS ?tmpCoord2)

  BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
  BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)

  BIND(?arrivalID AS ?id)
} ORDER BY ?name
````


### All Zoning Plans
Returns `zonenplan` (URL), `name` of all zoning plans.

````
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>

SELECT ?zonenplan ?name
FROM <https://linked.opendata.swiss/graph/sbb/nova>
WHERE {
  ?zonenplan a otd:ZoningPlan; 
               rdfs:label ?namen.
}
````

### All Stations from specified Zoning Plan
Returns `station` (URL), `name`, `coord`, `id` of all stations within a specific zoning plan.  
*Query Example:* All stations from zoning plan `ZVV Abo & Billet`.

````
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT distinct ?station ?name ?coord ?id
WHERE {
  ?Kante a otd:Relation; 
         otd:zoningPlan <http://lod.opentransportdata.swiss/zoningplan/zvv/zvv-abo-26amp-3b-billett>;
         schema:departureStation ?station.
  
  ?station rdfs:label ?name;
           <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?coord;
                                                             dcterms:identifier ?id.
}
````

### Distance of all Short Distances
Returns `distance` (in meters) of all short distances.

````
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
PREFIX unit: <http://qudt.org/vocab/unit#>
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
````

### ID of all Stations with Short Distances
Returns `id` (station ID) of all stations with short distances.

````
PREFIX schema: <http://schema.org/>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT distinct ?id
WHERE {
  ?Kante a otd:Relation;
           schema:departureStation ?departurePoint.

  ?departurePoint dcterms:identifier ?id .
}
````

### Number of Short Distances of Stations with Short Distances
Returns `departure`, `lat`, `lng`, `count` (number of short distances at this station) of all stations with short distances.  
Orders stations by descending count of short distances.

````
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT DISTINCT ?departure ?lat ?lng (count(?departureID) as ?count)
WHERE {
    ?Kante a otd:Relation;
           schema:departureStation ?departurePoint.
    
    ?departurePoint rdfs:label ?departure;
                    <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?departureCoord;
                    dcterms:identifier ?departureID.
    
    BIND(REPLACE(STR(?departureCoord), "POINT\\(", "") AS ?tmpCoord)
    BIND(REPLACE(?tmpCoord, "\\)", "") AS ?tmpCoord2)
  
    BIND(STRAFTER(?tmpCoord2, " ") AS ?lat)
    BIND(STRBEFORE(?tmpCoord2, " ") AS ?lng)
} GROUP BY ?departure ?lat ?lng ORDER BY DESC(?count)
````
