# Query Overview
This document contains all available SPARQL queries that we use in this project.  
Queries can be run under the following URL (unless otherwise stated) : [https://lindas.admin.ch/sparql/](https://lindas.admin.ch/sparql/)



### All Stations
Returns a list of all stations.  
**Required endpoint:** [https://ld.geo.admin.ch/query](https://ld.geo.admin.ch/query)

````
PREFIX geo:    <http://www.w3.org/2003/01/geo/wgs84_pos#>
PREFIX swiss:  <https://ld.geo.admin.ch/>
 
SELECT ?ID ?name ?lat ?lng {
    ?a a <http://vocab.gtfs.org/terms#Stop>.
    ?a <http://schema.org/name> ?name .
    ?a geo:lat ?lat .
    ?a geo:long ?lng .
    ?a <https://ld.geo.admin.ch/def/transportation/operatingPointType> ?Art
    
    BIND(STRAFTER(STR(?a), "stop/") AS ?ID)
}
````



### All Stations Matching List of Search Terms
Returns a list of all stations that match a list of search terms.
Example includes all stations containing "Thun" and "Bahnhof". Not case sensitive.

````
PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
PREFIX gtfs: <http://vocab.gtfs.org/terms#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT distinct ?Station ?name ?Coord
WHERE {
    ?Station rdfs:label ?name ;
    <http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;

    FILTER(contains(lcase(?name), lcase("Thun")))
    FILTER(contains(lcase(?name), lcase("Bahnhof")))
}
````



### 50 Longest Short Distances
Returns a list of the 50 longest short distances.

````
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


### Short Distances from a stationID
Returns a list of short distances from a stationID

````
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX otd: <http://lod.opentransportdata.swiss/vocab/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    SELECT ?arrival ?arrivalCoord ?arrivalID
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
    }
}
````

### All Zoning Plan
Returns all zoning plans

````
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
````

### Stations from a specific Zoning plan
Returns all zoning plans

````
PREFIX sc: <http://purl.org/science/owl/sciencecommons/>
PREFIX gtfs: <http://vocab.gtfs.org/terms#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX otd: <http://lod.opentransportdata.swiss/vocab/> PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT distinct ?Station ?Name ?Coord ?departureID
WHERE {
?Kante a otd:Relation; otd:zoningPlan
<http://lod.opentransportdata.swiss/zoningplan/zvv/zvv-abo-26amp-3b-billett>; schema:departureStation ?Station .
?Station rdfs:label ?Name ;
<http://www.opengis.net/ont/geosparql#hasGeometry>/<http://www.opengis.net/ont/geosparql#asWKT> ?Coord;              dcterms:identifier ?departureID .
} 

````

### All  monodirectional shortdistances
Returns monodirectional shortdistances

````
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
````

### List with Distance of all Short Distances
Returns a list that only includes the distance of all short distances.

````
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
````
