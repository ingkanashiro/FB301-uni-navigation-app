let map;
let pois = [];
let activeMarkers = {};
let activeRouteLine = null;

async function initMap() {
    const campusBorder = {
        north: -12.013813,
        south: -12.026240,
        east: -77.045373,
        west: -77.055469
    };

    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: -12.019176, lng: -77.049370 }, // Your uni coordinates
        zoom: 14,
        minZoom: 14,
        maxZoom: 20,
        // CRITICAL: Drop your generated Map ID right here!
        mapId: "f9a15dc8601bdd0cd7b9c08c", 
        colorScheme: "DARK",
        
        disableDefaultUI: true,

        restriction: {
            latLngBounds: campusBorder,
            strictBounds: true
        }
    });

    await loadGeoJSONMap();
    await getNodes();

    setupSearchInput('origin-search', 'origin-suggestions', 'origin-latlng');
    setupSearchInput('destination-search', 'destination-suggestions', 'dest-latlng');

    console.log('loading complete!');
}

async function getNodes() {
    try {
        // Load Points of Interest
        const response = await fetch('./include/nodes.json');
        const data = await response.json();
        pois = data.points;

        // Build the physical markers on the map canvas
        createMapMarkers();

    } catch (error) {
        console.error("Error loading data files:", error);
    }
}

function createMapMarkers() {
    pois.forEach(poi => {
        // Create a custom SVG marker to fit the sleek turquoise aesthetic
        const pinSvg = {
            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
            fillColor: "#89b4fa", // Catppuccin Blue / Turquoise accent
            fillOpacity: 0.9,
            strokeWeight: 1,
            strokeColor: "#11111b",
            scale: 1.5,
            anchor: new google.maps.Point(12, 24),
        };

        const marker = new google.maps.Marker({
            position: { lat: poi.coordinates.lat, lng: poi.coordinates.lng },
            map: map,
            title: poi.name,
            icon: pinSvg
        });

        // Optional: Open a clean text tooltip if they click a pin directly on the map
        const infoWindow = new google.maps.InfoWindow({
            content: `<div style="color:#11111b; font-family:sans-serif; font-weight:bold; padding:5px;">${poi.name}</div>`
        });

        marker.addListener("click", () => {
            infoWindow.open(map, marker);
        });

        // Store reference so we can manipulate or highlight markers later if needed
        activeMarkers[poi.id] = marker;
    });
}

function setupSearchInput(inputId, suggestionsId, hiddenCoordsId) {
    const inputElement = document.getElementById(inputId);
    const suggestionsBox = document.getElementById(suggestionsId);
    const hiddenCoordsInput = document.getElementById(hiddenCoordsId);

    inputElement.addEventListener("keyup", (e) => {
        const query = e.target.value.toLowerCase().trim();
        suggestionsBox.innerHTML = "";

        if (query === "") return;

        // Filter through official names OR alias arrays
        const matches = pois.filter(poi => {
            const nameMatch = poi.name.toLowerCase().includes(query);
            const aliasMatch = poi.aliases ? poi.aliases.some(alias => alias.toLowerCase().includes(query)) : false;
            return nameMatch || aliasMatch;
        });

        // Render matching suggestion elements
        matches.forEach(poi => {
            const item = document.createElement("div");
            item.className = "suggestion-item";
            item.innerText = poi.name;

            item.onclick = () => {
                inputElement.value = poi.name;
                
                // Store coordinates as a string "lat,lng" inside a hidden field for routing access
                hiddenCoordsInput.value = `${poi.coordinates.lat},${poi.coordinates.lng}`;
                suggestionsBox.innerHTML = ""; // close panel

                // Smoothly pan the map to center on the selected building
                map.panTo({ lat: poi.coordinates.lat, lng: poi.coordinates.lng });
                map.setZoom(17);
            };

            suggestionsBox.appendChild(item);
        });
    });

    // Close autocomplete lists if clicking completely outside the sidebar forms
    document.addEventListener("click", (e) => {
        if (e.target !== inputElement) {
            suggestionsBox.innerHTML = "";
        }
    });
}

function startRoute() {
    const startRaw = document.getElementById("origin-latlng").value;
    const endRaw = document.getElementById("dest-latlng").value;

    if (!startRaw || !endRaw) {
        alert("Please select both a valid origin and destination from the search box suggestions!");
        return;
    }

    // Convert string back to numeric coordinates
    const startCoords = startRaw.split(",").map(Number); // [lat, lng]
    const endCoords = endRaw.split(",").map(Number);     // [lat, lng]

    // Next step details:
    // 1. Pass startCoords & endCoords to your geojson parser to locate the nearest node ID.
    // 2. Run Dijkstra algorithm logic using those network entry IDs.
    // 3. Receive the array of path nodes, translate them to lat/lng positions, and pass to drawRouteOnGoogleMap().
    console.log("Routing initialized between nodes:", startCoords, "and", endCoords);
}

let graph = {}; // Your global Dijkstra-friendly graph

async function loadGeoJSONMap() {
    console.log('loading map...');

    try {
        const response = await fetch('include/uni.geojson');
        const geojsonData = await response.json();

        // 1. Build the Adjacency List Graph for Dijkstra
        geojsonData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.type === "LineString") {
                const coordinates = feature.geometry.coordinates; // Array of [lng, lat]

                for (let i = 0; i < coordinates.length - 1; i++) {
                    // Leaflet uses [lat, lng], but GeoJSON uses [lng, lat]. Let's swap them to keep Leaflet happy.
                    let currentCoord = [coordinates[i][1], coordinates[i][0]];
                    let nextCoord = [coordinates[i+1][1], coordinates[i+1][0]];

                    // Create unique string IDs based on coordinates
                    let nodeA_Id = currentCoord.join(",");
                    let nodeB_Id = nextCoord.join(",");

                    // Initialize Node A if it doesn't exist
                    if (!graph[nodeA_Id]) {
                        graph[nodeA_Id] = { coords: currentCoord, adjacents: [] };
                    }
                    // Initialize Node B if it doesn't exist
                    if (!graph[nodeB_Id]) {
                        graph[nodeB_Id] = { coords: nextCoord, adjacents: [] };
                    }

                    // Connect them bi-directionally (walking paths work both ways)
                    if (!graph[nodeA_Id].adjacents.includes(nodeB_Id)) {
                        graph[nodeA_Id].adjacents.push(nodeB_Id);
                    }
                    if (!graph[nodeB_Id].adjacents.includes(nodeA_Id)) {
                        graph[nodeB_Id].adjacents.push(nodeA_Id);
                    }
                }
            }
        });

        console.log("Graph built for Dijkstra!", graph);

    } catch (error) {
        console.error("Error loading or parsing GeoJSON:", error);
    }
}

window.initMap = initMap;