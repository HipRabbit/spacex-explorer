// --- KONFIGURATION & API ENDPOINTS ---
const API_SPACEX = 'https://api.spacexdata.com/v4'; // Genutzt für Raketen-Bilder
const API_DEVS = 'https://ll.thespacedevs.com/2.2.0'; // Genutzt für Live-Daten (Launches)

// --- GLOBALER STATE ---
let allLaunches = []; 
let allPastLaunches = [];
let currentOffset = 0; // Für Pagination

// --- LOKALISIERUNG (HARDCODED) ---
// Überschreibt englische API-Texte für ein konsistentes deutsches UI
const GERMAN_DESCRIPTIONS = {
    "Falcon 1": "Die Falcon 1 war die erste privat entwickelte Flüssigtreibstoffrakete, die einen Orbit erreichte. Sie ebnete den Weg für den heutigen Erfolg von SpaceX.",
    "Falcon 9": "Die Falcon 9 ist eine wiederverwendbare zweistufige Rakete für den zuverlässigen Transport von Menschen und Nutzlasten. Sie ist die weltweit erste Orbitalrakete, die landen kann.",
    "Falcon Heavy": "Die Falcon Heavy ist eine der leistungsstärksten operativen Raketen der Welt. Sie besteht aus drei Falcon-9-Kernen und kann bis zu 64 Tonnen in den Orbit bringen.",
    "Starship": "Das Starship-System ist ein vollständig wiederverwendbares Transportsystem, das entwickelt wurde, um Crew und Fracht zum Erdorbit, Mond, Mars und darüber hinaus zu bringen."
};

// --- ORBIT DEFINITIONEN ---
// Mapping technischer Codes zu lesbaren Namen
const ORBITS = {
    "LEO": "Low Earth Orbit (Niedriger Erdorbit)", "ISS": "International Space Station",
    "VLEO": "Very Low Earth Orbit (Starlink)", "SSO": "Sun-Synchronous Orbit (Sonnensynchron)",
    "MEO": "Medium Earth Orbit (Mittlerer Erdorbit)", "PO": "Polar Orbit (Polarbahn)", 
    "GTO": "Geostationary Transfer Orbit (Geotransfer)", "GEO": "Geostationary Orbit (Geostationär)",
    "HEO": "High Earth Orbit (Hoher Erdorbit)",
    "TLI": "Trans-Lunar Injection (Mond-Transfer)", "LO": "Lunar Orbit (Mondumlaufbahn)",
    "BLT": "Ballistic Lunar Transfer (Mond)", "L1": "Lagrange Punkt 1 (Sonne-Erde)",
    "L2": "Lagrange Punkt 2 (Deep Space)", "HCO": "Heliocentric Orbit (Sonne/Interplanetar)",
    "Sub": "Suborbital (Testflug)"
};

// Zuweisung der Orbits zu visuellen Ringen (CSS Animation)
const ORBIT_MAP = {
    "LEO": "leo", "ISS": "leo", "VLEO": "leo", "SSO": "leo", // Nahbereich
    "PO": "meo", "MEO": "meo", // Mittelbereich
    "GTO": "gto", "GEO": "gto", "HEO": "gto", "TLI": "gto", "LO": "gto", "BLT": "gto", "HCO": "gto", "L1": "gto", "L2": "gto" // Fernbereich
};

// --- CORE FUNCTIONS ---

/**
 * Generiert das HTML für eine Launch-Karte.
 * Behandelt Datumsformatierung (Platzhalter 31.12.) und Fallback-Bilder.
 */
function createLaunchCard(launch, isUpcoming) {
    const name = launch.name;
    const dateObj = new Date(launch.net);
    
    // Datum-Logik: Erkennt Platzhalter-Datum (31.12.) und formatiert es als "Geplant JAHR"
    let dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (dateObj.getDate() === 31 && dateObj.getMonth() === 11) {
        dateStr = `Geplant ${dateObj.getFullYear()}`;
    }

    const image = launch.image || 'https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png';
    const locationName = launch.pad ? launch.pad.location.name : "Unbekannt";
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;

    // Orbit Daten ermitteln
    let orbitShort = "TBD";
    let orbitFull = "Unbekannt";
    let orbitRing = null;

    if (launch.mission && launch.mission.orbit) {
        orbitShort = launch.mission.orbit.abbrev || "TBD";
        orbitFull = ORBITS[orbitShort] || launch.mission.orbit.name;
        orbitRing = ORBIT_MAP[orbitShort] || null;
    }

    // Status Badge (Nur für vergangene Missionen)
    let statusBadge = "";
    if (!isUpcoming) {
        const success = launch.status && launch.status.abbrev === "Success";
        const badgeClass = success ? "bg-success" : "bg-danger";
        const badgeText = success ? "Erfolg" : "Fehlschlag";
        statusBadge = `<span class="badge ${badgeClass} status-badge rounded-pill">${badgeText}</span>`;
    }

    // Video Button Logik
    let videoUrl = null;
    if(launch.vidURLs && launch.vidURLs.length > 0) videoUrl = launch.vidURLs[0].url;
    else if (launch.webcast_live) videoUrl = launch.webcast_live;
    
    // Wenn URL da ist: Button zeigen. Wenn nicht: Leeren String zurückgeben (Nichts anzeigen).
    const videoBtn = videoUrl 
        ? `<a href="${videoUrl}" target="_blank" class="btn btn-outline-info btn-sm flex-fill me-1"><i class="bi bi-play-circle me-1"></i> Stream</a>`
        : ``;

    const orbitDisabled = (orbitShort === "TBD" || !orbitRing) ? 'disabled' : '';
    const orbitLink = orbitDisabled ? '#' : `orbit.html?highlight=${orbitRing}&name=${orbitShort}`;

    return `
        <div class="col-md-6 col-lg-4">
            <div class="card glass-card text-white h-100 position-relative border-0 shadow-lg">
                ${statusBadge}
                <div class="img-wrapper p-0">
                    <img src="${image}" class="card-img-custom w-100" alt="${name}" onerror="this.src='https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png'">
                </div>
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title fw-bold mb-3">${name}</h5>
                    <div class="bg-dark bg-opacity-50 p-3 rounded mb-4 small flex-grow-1 border border-secondary border-opacity-25">
                        <div class="d-flex align-items-center mb-2 text-info-light"><i class="bi bi-calendar-event me-2 text-highlight"></i><span>${dateStr}</span></div>
                        <div class="d-flex align-items-center mb-2"><i class="bi bi-geo-alt me-2 text-highlight"></i><a href="${mapsLink}" target="_blank" class="text-white-50 text-decoration-none hover-white text-truncate" style="max-width:200px">${locationName}</a></div>
                        <div class="d-flex align-items-start"><i class="bi bi-bullseye me-2 text-highlight mt-1"></i><div><span class="fw-bold d-block">${orbitShort}</span><span class="text-white-50 x-small">${orbitFull}</span></div></div>
                    </div>
                    <div class="d-flex justify-content-between mt-auto gap-2">
                        ${videoBtn}
                        <a href="${orbitLink}" class="btn ${orbitDisabled ? 'btn-outline-secondary' : 'btn-outline-warning'} btn-sm flex-fill ${orbitDisabled}"><i class="bi bi-globe me-1"></i> Orbit</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- DATA FETCHING ---

/**
 * Lädt Daten von der API. Behandelt Pagination und Rate-Limits (429).
 */
async function fetchLaunches(mode, offset, append = false) {
    const container = mode === 'upcoming' ? document.getElementById('launches-container') : document.getElementById('past-container');
    const loading = document.getElementById('loading');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    const endpoint = mode === 'upcoming' ? 'upcoming' : 'previous';
    const limit = 30;
    
    try {
        if(!append) {
            // Reset bei neuem Aufruf
            if(mode === 'upcoming') allLaunches = []; else allPastLaunches = [];
            if(container) container.innerHTML = '';
            if(loading) loading.style.display = 'block';
        }

        const response = await fetch(`${API_DEVS}/launch/${endpoint}/?search=SpaceX&limit=${limit}&offset=${offset}`);
        
        // Error Handling für API Limits
        if (response.status === 429) throw new Error('API Rate Limit erreicht. Bitte später versuchen.');
        if (!response.ok) throw new Error('API Fehler');
        
        const data = await response.json();
        const newResults = data.results || [];

        // State Update
        if (mode === 'upcoming') {
            allLaunches = allLaunches.concat(newResults);
            if (offset === 0 && newResults.length > 0) initCountdown(newResults[0]);
            applyFilters('upcoming'); 
        } else {
            allPastLaunches = allPastLaunches.concat(newResults);
            applyFilters('past'); 
        }
        
        if(loading) loading.style.display = 'none';

        // Pagination Button Steuerung
        if (loadMoreBtn) {
            if (newResults.length < limit) loadMoreBtn.style.display = 'none'; 
            else loadMoreBtn.style.display = 'inline-block';
            loadMoreBtn.innerText = "Mehr laden";
        }

    } catch (error) {
        console.warn("Fetch Error:", error);
        if(loading) loading.innerHTML = `<div class="alert alert-warning bg-transparent text-white border-warning">${error.message}</div>`;
    }
}

// --- FILTER & SUCHE ---

function applyFilters(mode) {
    const container = mode === 'upcoming' ? document.getElementById('launches-container') : document.getElementById('past-container');
    const dataset = mode === 'upcoming' ? allLaunches : allPastLaunches;
    
    // Filter Inputs lesen
    const searchInput = document.getElementById('searchInput');
    const yearSelect = document.getElementById('yearFilter');
    const rocketSelect = document.getElementById('rocketFilter');

    if(!dataset || !container) return;

    const term = searchInput ? searchInput.value.toLowerCase() : "";
    const year = yearSelect ? yearSelect.value : "all";
    const rocket = rocketSelect ? rocketSelect.value : "all";

    // Client-seitiges Filtern
    const filtered = dataset.filter(l => {
        const matchesTerm = l.name.toLowerCase().includes(term);
        const lYear = new Date(l.net).getFullYear().toString();
        const matchesYear = year === "all" || lYear === year;
        
        const configName = l.rocket && l.rocket.configuration ? l.rocket.configuration.name : "";
        const matchesRocket = rocket === "all" || configName.includes(rocket) || l.name.includes(rocket);
        
        return matchesTerm && matchesYear && matchesRocket;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-white-50 py-5"><h4>Keine Missionen gefunden.</h4></div>';
    } else {
        container.innerHTML = filtered.map(l => createLaunchCard(l, mode === 'upcoming')).join('');
    }
}

function initFilters(mode) {
    // Event Listener für Echtzeit-Suche
    const searchInput = document.getElementById('searchInput');
    const yearSelect = document.getElementById('yearFilter');
    const rocketSelect = document.getElementById('rocketFilter');

    if(searchInput) searchInput.oninput = () => applyFilters(mode);
    if(yearSelect) yearSelect.onchange = () => applyFilters(mode);
    if(rocketSelect) rocketSelect.onchange = () => applyFilters(mode);
}

// --- INITIALISIERUNG ---
function loadLaunches() { currentOffset = 0; fetchLaunches('upcoming', 0); initFilters('upcoming'); }
function loadPastLaunches() { currentOffset = 0; fetchLaunches('previous', 0); initFilters('past'); }

function loadMore() {
    const btn = document.getElementById('loadMoreBtn');
    if(btn) btn.innerText = "Lade...";
    currentOffset += 30;
    const mode = document.getElementById('past-container') ? 'previous' : 'upcoming';
    const modeStr = mode === 'previous' ? 'past' : 'upcoming';
    fetchLaunches(modeStr, currentOffset, true);
}

// --- ROCKETS (HYBRID: API V4 + STATIC DATA) ---
async function loadRockets() {
    const container = document.getElementById('rockets-container');
    const loading = document.getElementById('loading');
    
    try {
        // 1. Hole Bilder von der SpaceX API v4
        const response = await fetch(`${API_SPACEX}/rockets`);
        let data = await response.json();
        
        // 2. Starship manuell hinzufügen (da nicht in API v4 enthalten)
        const starship = {
            name: "Starship",
            active: true,
            description: "Das größte und leistungsstärkste Raketensystem der Geschichte. Entwickelt für Missionen zum Mond und Mars.",
            height: { meters: 121 },
            mass: { kg: 5000000 },
            cost_per_launch: 10000000, 
            flickr_images: ["https://live.staticflickr.com/65535/52839933099_89c0379208_b.jpg"],
            wikipedia: "https://de.wikipedia.org/wiki/Starship",
            // HIER IST DAS VIDEO:
            video: "https://www.youtube.com/watch?v=ap-BkkrRg-o" 
        };
        data.push(starship);

        if(loading) loading.style.display = 'none';
        
        if(container) {
            container.innerHTML = data.map(rocket => {
                const statusClass = rocket.active ? 'bg-success' : 'bg-secondary';
                const statusText = rocket.active ? 'Aktiv' : 'Inaktiv';
                
                // Deutsche Beschreibung anwenden
                const germanDesc = GERMAN_DESCRIPTIONS[rocket.name] || rocket.description;
                
                const cost = rocket.cost_per_launch 
                    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(rocket.cost_per_launch) 
                    : "TBD";
                const img = rocket.flickr_images.length > 0 
                    ? rocket.flickr_images[0] 
                    : "https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png";

                // VIDEO BUTTON LOGIK
                // Zeigt den Button nur an, wenn ein Video-Link existiert (aktuell nur bei Starship)
                const videoBtn = rocket.video 
                    ? `<a href="${rocket.video}" target="_blank" class="btn btn-sm btn-outline-danger flex-fill"><i class="bi bi-youtube"></i> Testflug</a>` 
                    : ``;

                return `
                <div class="col-lg-6">
                    <div class="card glass-card text-white overflow-hidden h-100 border-0 shadow-sm">
                        <div class="row g-0 h-100">
                            <div class="col-md-5">
                                <img src="${img}" class="img-fluid h-100 w-100" style="object-fit: cover; min-height: 250px;" onerror="this.src='https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png'">
                            </div>
                            <div class="col-md-7">
                                <div class="card-body d-flex flex-column h-100">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h3 class="card-title fw-bold m-0">${rocket.name}</h3>
                                        <span class="badge ${statusClass} rounded-pill">${statusText}</span>
                                    </div>
                                    <p class="card-text small text-white-50 mt-2 flex-grow-1">${germanDesc}</p>
                                    <div class="bg-dark bg-opacity-50 p-2 rounded small mb-3 border border-secondary border-opacity-25">
                                        <div>Höhe: <strong>${rocket.height.meters} m</strong></div>
                                        <div class="text-highlight">Kosten: <strong>${cost}</strong></div>
                                    </div>
                                    
                                    <div class="d-flex gap-2 mt-auto">
                                        <a href="${rocket.wikipedia}" target="_blank" class="btn btn-sm btn-light flex-fill">Wikipedia</a>
                                        ${videoBtn}
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (error) {
        console.error("Raketen Ladefehler:", error);
        if(loading) loading.innerHTML = `<p class="text-danger">Fehler beim Laden der Raketen.</p>`;
    }
}
// --- STATISTIK (HYBRID: HISTORIE + LIVE API) ---
async function loadStats() {
    // 1. Statische Basis-Daten (bis Ende 2024)
    const historicalCounts = {
        2008: 2, 2009: 1, 2010: 2, 2011:1, 2012: 2, 2013: 3, 2014: 6, 2015: 7, 
        2016: 9, 2017: 18, 2018: 21, 2019: 13, 2020: 26, 2021: 31, 
        2022: 61, 2023: 96, 2024: 127
    };
    
    let totalSuccess = 422; 
    let totalFailure = 4;   
    let launches2025 = 0;

    try {
        // 2. Live-Daten abrufen (Limit=100 für vollständiges Jahr)
        const response = await fetch(`${API_DEVS}/launch/previous/?search=SpaceX&limit=100`);
        if(response.ok) {
            const data = await response.json();
            data.results.forEach(launch => {
                const year = new Date(launch.net).getFullYear();
                // Nur Daten ab 2025 zur Historie hinzufügen
                if(year >= 2025) {
                    launches2025++;
                    historicalCounts[year] = (historicalCounts[year] || 0) + 1;
                    
                    if(launch.status && launch.status.abbrev === 'Success') totalSuccess++;
                    else totalFailure++;
                }
            });
        }
    } catch(e) { console.warn("Stats API Fallback"); }

    const totalLaunches = 426 + launches2025; 
    const successRate = ((totalSuccess / totalLaunches) * 100).toFixed(1);

    // DOM Updates
    if(document.getElementById('total-launches')) {
        document.getElementById('total-launches').innerText = totalLaunches;
        document.getElementById('success-rate').innerText = successRate + "%";
        document.getElementById('active-rockets').innerText = "3"; 
    }

    // Chart.js Initialisierung
    const ctxYear = document.getElementById('yearChart');
    if(ctxYear) new Chart(ctxYear, { type: 'bar', data: { labels: Object.keys(historicalCounts), datasets: [{ label: 'Starts pro Jahr', data: Object.values(historicalCounts), backgroundColor: '#00a8e8', borderRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#bbb'} }, y: { grid: { color: 'rgba(255,255,255,0.1)' } } } } });
    
    const ctxSuccess = document.getElementById('successChart');
    if(ctxSuccess) new Chart(ctxSuccess, { type: 'doughnut', data: { labels: ['Erfolg', 'Fehlschlag'], datasets: [{ data: [totalSuccess, totalFailure], backgroundColor: ['#198754', '#dc3545'], borderWidth: 0 }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } } });
}

// --- WIDGETS ---
function initCountdown(nextLaunch) {
    const timerElem = document.getElementById('countdown-timer');
    const nameElem = document.getElementById('next-mission-name');
    if(!timerElem) return;
    document.getElementById('countdown-container').classList.remove('d-none');
    nameElem.innerText = `Nächste Mission: ${nextLaunch.name}`;
    const targetDate = new Date(nextLaunch.net).getTime();
    
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;
        if (distance < 0) { clearInterval(interval); timerElem.innerHTML = "LIFTOFF! 🚀"; return; }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        timerElem.innerHTML = `${d}d ${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
    }, 1000);
}

function initOrbitPage() {
    const params = new URLSearchParams(window.location.search);
    const highlightRing = params.get('highlight');
    const orbitName = params.get('name');
    if (highlightRing && orbitName) {
        const ringElement = document.getElementById(`ring-${highlightRing}`);
        const infoElement = document.getElementById('orbit-info');
        if (ringElement) {
            ringElement.classList.add('orbit-active');
            infoElement.innerHTML = `<h2 class="text-highlight">Zielorbit: ${orbitName}</h2><p class="lead">Die Rakete steuert diesen Bereich an.</p>`;
        }
    }
}

async function loadCompanyData() {
    if (!document.getElementById('comp-ceo')) return;
    document.getElementById('comp-ceo').innerText = "Elon Musk";
    document.getElementById('comp-employees').innerText = "13.000+";
    document.getElementById('comp-valuation').innerText = "$210 Mrd."; 
    document.getElementById('comp-hq').innerText = "Starbase, Texas";
}