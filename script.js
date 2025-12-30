// --- KONFIGURATION ---
const API_SPACEX = 'https://api.spacexdata.com/v4'; 
const API_DEVS = 'https://ll.thespacedevs.com/2.2.0'; 

// Globaler Speicher
let allLaunches = []; 
let allPastLaunches = [];
let currentOffset = 0; 

// --- DEUTSCHE TEXTE (Zum Überschreiben der API-Daten) ---
const GERMAN_DESCRIPTIONS = {
    "Falcon 1": "Die Falcon 1 war die erste privat entwickelte Flüssigtreibstoffrakete, die einen Orbit erreichte. Sie ebnete den Weg für den heutigen Erfolg von SpaceX.",
    "Falcon 9": "Die Falcon 9 ist eine wiederverwendbare zweistufige Rakete für den zuverlässigen Transport von Menschen und Nutzlasten. Sie ist die weltweit erste Orbitalrakete, die landen kann.",
    "Falcon Heavy": "Die Falcon Heavy ist eine der leistungsstärksten operativen Raketen der Welt. Sie besteht aus drei Falcon-9-Kernen und kann bis zu 64 Tonnen in den Orbit bringen.",
    "Starship": "Das Starship-System ist ein vollständig wiederverwendbares Transportsystem, das entwickelt wurde, um Crew und Fracht zum Erdorbit, Mond, Mars und darüber hinaus zu bringen."
};

// --- ERWEITERTE ORBIT LISTE ---
const ORBITS = {
    // Low Earth
    "LEO": "Low Earth Orbit (Niedriger Erdorbit)", 
    "ISS": "International Space Station",
    "VLEO": "Very Low Earth Orbit (Starlink)", 
    "SSO": "Sun-Synchronous Orbit (Sonnensynchron)",
    // Medium Earth
    "MEO": "Medium Earth Orbit (Mittlerer Erdorbit)",
    "PO": "Polar Orbit (Polarbahn)", 
    // High Earth / Geostationary
    "GTO": "Geostationary Transfer Orbit (Geotransfer)", 
    "GEO": "Geostationary Orbit (Geostationär)",
    "HEO": "High Earth Orbit (Hoher Erdorbit)",
    // Deep Space / Moon / Sun
    "TLI": "Trans-Lunar Injection (Mond-Transfer)", 
    "LO": "Lunar Orbit (Mondumlaufbahn)",
    "BLT": "Ballistic Lunar Transfer (Mond)",
    "L1": "Lagrange Punkt 1 (Sonne-Erde)",
    "L2": "Lagrange Punkt 2 (Deep Space)",
    "HCO": "Heliocentric Orbit (Sonne/Interplanetar)",
    "Sub": "Suborbital (Testflug)"
};

// Mapping auf die 3 visuellen Ringe (Leo = Nah, Meo = Mittel, Gto = Fern)
const ORBIT_MAP = {
    // Innerer Ring (Nahbereich)
    "LEO": "leo", "ISS": "leo", "VLEO": "leo", "SSO": "leo", 
    // Mittlerer Ring
    "PO": "meo", "MEO": "meo", 
    // Äußerer Ring (Fernbereich & Deep Space)
    "GTO": "gto", "GEO": "gto", "HEO": "gto", 
    "TLI": "gto", "LO": "gto", "BLT": "gto",
    "HCO": "gto", "L1": "gto", "L2": "gto"
};

// --- HELPER: KARTEN GENERIEREN ---
function createLaunchCard(launch, isUpcoming) {
    const name = launch.name;
    const dateObj = new Date(launch.net);
    
    // --- DATUM KOSMETIK START ---
    // Standard-Formatierung
    let dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // Wenn das Datum der 31.12. ist (Monat 11, da JS Monate von 0-11 zählt),
    // gehen wir davon aus, dass es ein Platzhalter für das Jahr ist.
    if (dateObj.getDate() === 31 && dateObj.getMonth() === 11) {
        dateStr = `Geplant ${dateObj.getFullYear()}`; // Zeigt z.B. "Geplant 2026"
    }
    // --- DATUM KOSMETIK ENDE ---

    const image = launch.image || 'https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png';
    const locationName = launch.pad ? launch.pad.location.name : "Unbekannt";
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;

    // ... (Der Rest der Funktion bleibt exakt gleich wie vorher) ...
    let orbitShort = "TBD";
    let orbitFull = "Unbekannt";
    let orbitRing = null;

    if (launch.mission && launch.mission.orbit) {
        orbitShort = launch.mission.orbit.abbrev || "TBD";
        orbitFull = ORBITS[orbitShort] || launch.mission.orbit.name;
        orbitRing = ORBIT_MAP[orbitShort] || null;
    }

    let statusBadge = "";
    if (!isUpcoming) {
        const success = launch.status && launch.status.abbrev === "Success";
        const badgeClass = success ? "bg-success" : "bg-danger";
        const badgeText = success ? "Erfolg" : "Fehlschlag";
        statusBadge = `<span class="badge ${badgeClass} status-badge rounded-pill">${badgeText}</span>`;
    }

    let videoUrl = null;
    if(launch.vidURLs && launch.vidURLs.length > 0) videoUrl = launch.vidURLs[0].url;
    else if (launch.webcast_live) videoUrl = launch.webcast_live;
    
    const videoBtn = videoUrl 
        ? `<a href="${videoUrl}" target="_blank" class="btn btn-outline-info btn-sm flex-fill me-1"><i class="bi bi-play-circle me-1"></i> Stream</a>`
        : `<button class="btn btn-outline-secondary btn-sm flex-fill me-1" disabled>Kein Video</button>`;

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

async function fetchLaunches(mode, offset, append = false) {
    const container = mode === 'upcoming' ? document.getElementById('launches-container') : document.getElementById('past-container');
    const loading = document.getElementById('loading');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    const endpoint = mode === 'upcoming' ? 'upcoming' : 'previous';
    const limit = 30;
    
    try {
        if(!append) {
            if(mode === 'upcoming') allLaunches = []; else allPastLaunches = [];
            if(container) container.innerHTML = '';
            if(loading) loading.style.display = 'block';
        }

        const response = await fetch(`${API_DEVS}/launch/${endpoint}/?search=SpaceX&limit=${limit}&offset=${offset}`);
        
        if (response.status === 429) throw new Error('API Rate Limit. Bitte später versuchen.');
        if (!response.ok) throw new Error('API Fehler');
        
        const data = await response.json();
        const newResults = data.results || [];

        if (mode === 'upcoming') {
            allLaunches = allLaunches.concat(newResults);
            if (offset === 0 && newResults.length > 0) initCountdown(newResults[0]);
            applyFilters('upcoming'); 
        } else {
            allPastLaunches = allPastLaunches.concat(newResults);
            applyFilters('past'); 
        }
        
        if(loading) loading.style.display = 'none';

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

// --- FILTER SYSTEM ---

function applyFilters(mode) {
    const container = mode === 'upcoming' ? document.getElementById('launches-container') : document.getElementById('past-container');
    const dataset = mode === 'upcoming' ? allLaunches : allPastLaunches;
    
    const searchInput = document.getElementById('searchInput');
    const yearSelect = document.getElementById('yearFilter');
    const rocketSelect = document.getElementById('rocketFilter');

    if(!dataset || !container) return;

    const term = searchInput ? searchInput.value.toLowerCase() : "";
    const year = yearSelect ? yearSelect.value : "all";
    const rocket = rocketSelect ? rocketSelect.value : "all";

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
    const searchInput = document.getElementById('searchInput');
    const yearSelect = document.getElementById('yearFilter');
    const rocketSelect = document.getElementById('rocketFilter');

    if(searchInput) searchInput.oninput = () => applyFilters(mode);
    if(yearSelect) yearSelect.onchange = () => applyFilters(mode);
    if(rocketSelect) rocketSelect.onchange = () => applyFilters(mode);
}

// --- INIT LOADER ---
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

// --- ROCKETS (MIX: API FÜR BILDER + DEUTSCHER TEXT) ---
async function loadRockets() {
    const container = document.getElementById('rockets-container');
    const loading = document.getElementById('loading');
    
    try {
        // 1. Hole echte Daten von der alten API (Da funktionieren die Bilder!)
        const response = await fetch(`${API_SPACEX}/rockets`);
        let data = await response.json();
        
        // 2. Starship manuell ergänzen
        const starship = {
            name: "Starship",
            active: true,
            description: "Starship Placeholder", // Wird gleich überschrieben
            height: { meters: 121 },
            mass: { kg: 5000000 },
            cost_per_launch: 10000000, 
            // Stabiler Link für Starship
            flickr_images: ["https://live.staticflickr.com/65535/52839933099_89c0379208_b.jpg"],
            wikipedia: "https://de.wikipedia.org/wiki/Starship"
        };
        data.push(starship);

        if(loading) loading.style.display = 'none';
        
        if(container) {
            container.innerHTML = data.map(rocket => {
                const statusClass = rocket.active ? 'bg-success' : 'bg-secondary';
                const statusText = rocket.active ? 'Aktiv' : 'Inaktiv';
                
                // DEUTSCHE ÜBERSETZUNG ANWENDEN
                // Wir nehmen den deutschen Text aus unserer Liste oben, falls vorhanden.
                const germanDesc = GERMAN_DESCRIPTIONS[rocket.name] || rocket.description;
                
                // Kosten formatieren
                const cost = rocket.cost_per_launch 
                    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(rocket.cost_per_launch) 
                    : "TBD";

                // Bild wählen (API Bild oder Fallback)
                const img = rocket.flickr_images.length > 0 
                    ? rocket.flickr_images[0] 
                    : "https://images2.imgbox.com/3c/0e/T8iJcSN3_o.png";

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
                                    <a href="${rocket.wikipedia}" target="_blank" class="btn btn-sm btn-light mt-auto w-100">Wikipedia</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (error) {
        console.error("Raketen Fehler:", error);
        if(loading) loading.innerHTML = `<p class="text-danger">Fehler beim Laden der Raketen.</p>`;
    }
}

// --- STATS ---
// --- STATS (HYBRID) ---
async function loadStats() {
    // 1. FESTE Historie bis Ende 2024 (Daten von SpaceX Stats)
    const historicalCounts = {
        2008: 2, 2009: 1, 2010: 2, 2011:1, 2012: 2, 2013: 3, 2014: 6, 2015: 7, 
        2016: 9, 2017: 18, 2018: 21, 2019: 13, 2020: 26, 2021: 31, 
        2022: 61, 2023: 96, 2024: 127
    };
    
    // Basiserfolge bis Ende 2024
    let totalSuccess = 422; 
    let totalFailure = 4;   
    let launches2025 = 0;

    try {
        // FIX: Limit von 40 auf 100 erhöht, um alle 2025er Starts zu erfassen
        const response = await fetch(`${API_DEVS}/launch/previous/?search=SpaceX&limit=100`);
        if(response.ok) {
            const data = await response.json();
            data.results.forEach(launch => {
                const year = new Date(launch.net).getFullYear();
                // Nur Jahre ab 2025 berücksichtigen
                if(year >= 2025) {
                    launches2025++;
                    // Falls das Jahr schon existiert hochzählen, sonst initialisieren
                    historicalCounts[year] = (historicalCounts[year] || 0) + 1;
                    
                    if(launch.status && launch.status.abbrev === 'Success') totalSuccess++;
                    else totalFailure++;
                }
            });
        }
    } catch(e) { console.warn("Stats API Limit"); }

    const totalLaunches = 426 + launches2025; // Basis + Live 2025
    
    // Berechnung der Erfolgsrate
    const successRate = ((totalSuccess / totalLaunches) * 100).toFixed(1);

    if(document.getElementById('total-launches')) {
        document.getElementById('total-launches').innerText = totalLaunches;
        document.getElementById('success-rate').innerText = successRate + "%";
        document.getElementById('active-rockets').innerText = "3"; 
    }

    const ctxYear = document.getElementById('yearChart');
    if(ctxYear) new Chart(ctxYear, { type: 'bar', data: { labels: Object.keys(historicalCounts), datasets: [{ label: 'Starts pro Jahr', data: Object.values(historicalCounts), backgroundColor: '#00a8e8', borderRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#bbb'} }, y: { grid: { color: 'rgba(255,255,255,0.1)' } } } } });
    
    const ctxSuccess = document.getElementById('successChart');
    if(ctxSuccess) new Chart(ctxSuccess, { type: 'doughnut', data: { labels: ['Erfolg', 'Fehlschlag'], datasets: [{ data: [totalSuccess, totalFailure], backgroundColor: ['#198754', '#dc3545'], borderWidth: 0 }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } } });
}

// --- HELPER (Rest) ---
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