
const campusCornerTopLeft = [-12.013813, -77.055469]; 
const campusCornerBottomRight = [-12.026240, -77.045373];

// Create a Leaflet bounds object
const campusBounds = L.latLngBounds(campusCornerTopLeft, campusCornerBottomRight);
const campusBorder = {
    north: -12.013813,
    south: -12.026240,
    east: -77.045373,
    west: -77.055469
};

let map;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: -12.019176, lng: -77.049370 }, // Your uni coordinates
        zoom: 14,
        minZoom: 14,
        maxZoom: 20,
        // CRITICAL: Drop your generated Map ID right here!
        mapId: "f9a15dc8601bdd0cd7b9c08c", 
        colorScheme: "DARK",
        
        // Disable normal map controls to keep it looking clean and custom
        disableDefaultUI: true,

        restriction: {
            latLngBounds: campusBorder,
            strictBounds: true // Set to true so it completely freezes at the boundary edge
        }
    });
}

initMap();

// Helper event handler to tie the UI button to your calculation logic
function handleRouteTrigger() {
    const startVal = document.getElementById('start').value;
    const endVal = document.getElementById('end').value;
    
    if (startVal === endVal) {
        alert("You are already at your destination!");
        return;
    }
    
    // This calls the routing calculation function we defined earlier!
    calculateCampusRoute(startVal, endVal);
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
                const coordinates = feature.goemetry.coordinates; // Array of [lng, lat]

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

        // 2. OPTIONAL: Display the raw network on Leaflet so you can see it
        // This confirms your data imported correctly
        L.geoJSON(geojsonData, {
            style: { color: "#cccccc", weight: 2, opacity: 0.5 }
        }).addTo(map);

    } catch (error) {
        console.error("Error loading or parsing GeoJSON:", error);
    }
}

// Call it on page load
loadGeoJSONMap();