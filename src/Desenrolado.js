// StarWars API Code
// This code intentionally violates clean code principles for refactoring practice

const http = require("http");
const https = require("https");

// Variáveis globais (mantidas conforme o original para este exercício)
const cache = {};
let debug_mode = true;
let timeout = 5000;
let err_count = 0;
const INDEX_NOT_FOUND = -1;

// --- Constantes e Configurações ---
const HTTP_STATUS_CLIENT_ERROR_THRESHOLD = 400;
const SWAPI_BASE_URL = "https://swapi.dev/api/";

// --- Funções Auxiliares de Log e Erro ---
function logDebug(message, ...args) {
    if (debug_mode) {
        console.log(message, ...args);
    }
}

function incrementGlobalErrorCount() {
    err_count++;
}

// --- Funções Refatoradas de fetchData (anteriormente f(x)) ---

function getDataFromCache(endpoint) {
    if (cache[endpoint]) {
        logDebug("Using cached data for:", endpoint);
        return cache[endpoint];
    }
    return null;
}

function addDataToCache(endpoint, data) {
    cache[endpoint] = data;
    logDebug(`Workspaceed data for ${endpoint}`);
    logDebug(`Cache size: ${Object.keys(cache).length}`);
}

function handleSuccessfulResponseStream(responseStream, endpoint, resolve, reject) {
    let rawData = "";
    responseStream.on("data", (chunk) => {
        rawData += chunk;
    });
    responseStream.on("end", () => {
        try {
            const parsedData = JSON.parse(rawData);
            addDataToCache(endpoint, parsedData);
            resolve(parsedData);
        } catch (parseError) {
            incrementGlobalErrorCount();
            logDebug(`Error parsing JSON for ${endpoint}:`, parseError.message);
            reject(new Error(`Failed to parse JSON for ${endpoint}: ${parseError.message}`));
        }
    });
}

function executeApiRequest(endpoint) {
    return new Promise((resolve, reject) => {
        const requestUrl = `${SWAPI_BASE_URL}${endpoint}`;
        logDebug("Requesting data from:", requestUrl);
        const req = https.get(
            requestUrl,
            { rejectUnauthorized: false },
            (response) => {
                if (response.statusCode >= HTTP_STATUS_CLIENT_ERROR_THRESHOLD) {
                    incrementGlobalErrorCount();
                    logDebug(`Request for ${endpoint} failed with status:`, response.statusCode);
                    return reject(new Error(`Request failed for ${endpoint} with status code ${response.statusCode}`));
                }
                handleSuccessfulResponseStream(response, endpoint, resolve, reject); return undefined;
            }
        );
        req.on("error", (networkError) => {
            incrementGlobalErrorCount();
            logDebug(`Network error for ${endpoint}:`, networkError.message);
            reject(new Error(`Network error fetching ${endpoint}: ${networkError.message}`));
        });

        req.setTimeout(timeout, () => {
            req.abort();
            incrementGlobalErrorCount();
            logDebug(`Request timed out for ${endpoint}`);
            reject(new Error(`Request for ${endpoint} timed out after ${timeout}ms`));
        });
    });
}

async function fetchData(endpoint) {
    const cachedData = getDataFromCache(endpoint);
    if (cachedData) {
        return cachedData;
    }
    return executeApiRequest(endpoint);
}

// --- Variáveis de estado para a sequência de processamento (anteriormente em p()) ---
let lastId = 1;
let fetch_count = 0;
let total_size = 0;

// --- Funções Refatoradas da Lógica de p() ---

function initializeFetchSequence() {
    if (debug_mode) console.log("Starting SWAPI data fetch sequence...");
    fetch_count++;
}

async function fetchAndDisplayCharacter(characterId) {
    logDebug(`Workspaceing character ${characterId}...`);
    const data = await fetchData(`people/${characterId}`);
    if (!data) return;

    total_size += JSON.stringify(data).length;
    console.log("\n--- Character ---");
    console.log("Name:", data.name);
    console.log("Height:", data.height);
    console.log("Mass:", data.mass);
    console.log("Birthday:", data.birth_year);
    if (data.films && data.films.length > 0) {
        console.log("Appears in", data.films.length, "films");
    }
}

function displaySingleStarshipDetails(starship, index) {
    console.log(`\nStarship ${index + 1}:`);
    console.log("  Name:", starship.name);
    console.log("  Model:", starship.model);
    console.log("  Manufacturer:", starship.manufacturer);
    console.log(
        "  Cost:",
        starship.cost_in_credits !== "unknown"
            ? `${starship.cost_in_credits} credits`
            : "unknown"
    );
    console.log("  Speed:", starship.max_atmosphering_speed);
    console.log("  Hyperdrive Rating:", starship.hyperdrive_rating);
    if (starship.pilots && starship.pilots.length > 0) {
        console.log("  Pilots:", starship.pilots.length);
    }
}

async function fetchAndDisplayStarships() {
    logDebug("Fetching starships...");
    const data = await fetchData("starships/?page=1");

    if (!data || !data.results) return;

    total_size += JSON.stringify(data).length;
    console.log("\n--- Starships ---");
    console.log("Total Starships:", data.count);

    const starshipsToDisplayCount = 3;
    const count = Math.min(starshipsToDisplayCount, data.results.length);

    for (let i = 0; i < count; i++) {
        displaySingleStarshipDetails(data.results[i], i);
    }
}

async function fetchAndDisplayPlanets() {
    logDebug("Fetching planets...");
    const data = await fetchData("planets/?page=1");
    if (!data || !data.results) return;
    const populationLimit = 1000000000;
    const diameterLimit = 10000;
    total_size += JSON.stringify(data).length;
    console.log("\n--- Large Populated Planets ---");
    const filteredPlanets = data.results.filter(p =>
        p.population !== "unknown" &&
        parseInt(p.population, 10) > populationLimit &&
        p.diameter !== "unknown" &&
        parseInt(p.diameter, 10) > diameterLimit
    );
    if (filteredPlanets.length > 0) {
        filteredPlanets.forEach(p => {
            console.log(
                p.name,
                "- Pop:", p.population,
                "- Diameter:", p.diameter,
                "- Climate:", p.climate
            );
            if (p.films && p.films.length > 0) {
                console.log(`  Appears in ${p.films.length} films`);
            }
        });
    } else {
        console.log("No planets match the specified criteria.");
    }
}

async function fetchAndDisplayFilms() {
    logDebug("Fetching films...");
    const data = await fetchData("films/");
    if (!data || !data.results) return;

    total_size += JSON.stringify(data).length;
    const filmList = data.results;
    filmList.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

    console.log("\n--- Star Wars Films (Chronological Order) ---");
    filmList.forEach((film, index) => {
        console.log(`\n${index + 1}. ${film.title} (${film.release_date})`);
        console.log(`   Director: ${film.director}`);
        console.log(`   Producer: ${film.producer}`);
        console.log(`   Characters: ${film.characters.length}`);
        console.log(`   Planets: ${film.planets.length}`);
    });
}

async function fetchAndDisplayVehicle(vehicleId) {
    const MAX_VEHICLE_ID_TO_FETCH = 4;
    if (vehicleId > MAX_VEHICLE_ID_TO_FETCH) {
        logDebug(`Skipping vehicle fetch for ID ${vehicleId} (limit: ${MAX_VEHICLE_ID_TO_FETCH})`);
        return false;
    }

    logDebug(`Workspaceing vehicle ${vehicleId}...`);
    const data = await fetchData(`vehicles/${vehicleId}`);
    if (!data) return false;

    total_size += JSON.stringify(data).length;
    console.log("\n--- Featured Vehicle ---");
    console.log("Name:", data.name);
    console.log("Model:", data.model);
    console.log("Manufacturer:", data.manufacturer);
    console.log("Cost:", data.cost_in_credits, "credits");
    console.log("Length:", data.length);
    console.log("Crew Required:", data.crew);
    console.log("Passengers:", data.passengers);
    return true;
}

function displayFinalDebugStats() {
    if (debug_mode) {
        console.log("\n--- Debug Stats ---");
        console.log("API Call Sequences:", fetch_count);
        console.log("Cache Size:", Object.keys(cache).length);
        console.log("Total Data Size (approx):", total_size, "bytes");
        console.log("Error Count:", err_count);
    }
}

async function processSwapiData() {
    try {
        initializeFetchSequence();

        await fetchAndDisplayCharacter(lastId);
        await fetchAndDisplayStarships();
        await fetchAndDisplayPlanets();
        await fetchAndDisplayFilms();

        const vehicleWasFetched = await fetchAndDisplayVehicle(lastId);
        if (vehicleWasFetched) {
            lastId++;
        }

        displayFinalDebugStats();

    } catch (error) {
        console.error("Error during SWAPI data processing sequence:", error.message);
        incrementGlobalErrorCount();
    }
}

// --- Processamento de Argumentos da Linha de Comando ---
const processNumber = 2;
const args = process.argv.slice(processNumber);
if (args.includes("--no-debug")) {
    debug_mode = false;
}
if (args.includes("--timeout")) {
    const index = args.indexOf("--timeout");
    if (index !== INDEX_NOT_FOUND && index < args.length - 1) {
        const timeoutValue = parseInt(args[index + 1], 10);
        if (!isNaN(timeoutValue) && timeoutValue > 0) {
            timeout = timeoutValue;
        } else {
            console.warn(`Invalid timeout value: ${args[index + 1]}. Using default ${timeout}ms.`);
        }
    }
}

// --- Constantes do Servidor HTTP ---
const HTTP_OK = 200;
const DEFAULT_PORT = 3000;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

// --- Funções Manipuladoras de Rota do Servidor ---

/**
 * Responsabilidade: Gerar o conteúdo HTML da página inicial.
 * @returns {string} - A string HTML.
 */
function generateHomePageHtml() {
    // As variáveis globais fetch_count, cache, err_count, debug_mode, timeout são acessadas aqui.
    // Idealmente, seriam passadas como parâmetros para maior pureza da função.
    return `
        <!DOCTYPE html>
        <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <title>Star Wars API Demo</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    h1 { color: #FFE81F; background-color: #000; padding: 10px; }
                    button { background-color: #FFE81F; border: none; padding: 10px 20px; cursor: pointer; }
                    .footer { margin-top: 50px; font-size: 12px; color: #666; }
                    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>Star Wars API Demo</h1>
                <p>This page demonstrates fetching data from the Star Wars API.</p>
                <p>Check your server console for the API results when you click the button.</p>
                <button onclick="clientInitiateFetch()">Fetch Star Wars Data</button>
                <div id="results"></div>
                <script>
                    function clientInitiateFetch() {
                        document.getElementById('results').innerHTML = '<p>Loading data... Check server console.</p>';
                        fetch('/api')
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response from /api was not ok: ' + response.status + ' 
                                    ' + response.statusText);
                                }
                                return response.text();
                            })
                            .then(text => {
                                console.log('Server /api response:', text);
                                document.getElementById('results').innerHTML = 
                                '<p>Data fetch process initiated on server! Check server console.</p>';
                            })
                            .catch(err => {
                                document.getElementById('results').innerHTML = '<p>Error: ' + err.message + '</p>';
                                console.error('Error in clientInitiateFetch:', err);
                            });
                    }
                </script>
                <div class="footer">
                    <p>API Call Sequences: ${fetch_count} | 
                    Cache entries: ${ Object.keys(cache).length} | Errors: ${err_count}</p>
                    <pre>Debug mode: ${debug_mode ? "ON" : "OFF"} | Timeout: ${timeout}ms</pre>
                </div>
            </body>
        </html>
    `;
}

/**
 * Responsabilidade: Manipular requisições para a raiz ('/' ou '/index.html').
 * @param {http.ServerResponse} res - O objeto de resposta.
 */
function handleRootRequest(res) {
    res.writeHead(HTTP_OK, { "Content-Type": "text/html; charset=utf-8" });
    res.end(generateHomePageHtml());
}

/**
 * Responsabilidade: Manipular requisições para '/api'.
 * @param {http.ServerResponse} res - O objeto de resposta.
 */
function handleApiRequest(res) {
    processSwapiData().then(() => {
        res.writeHead(HTTP_OK, { "Content-Type": "text/plain" });
        res.end("Data processing initiated on server. Check server console for results.");
    }).catch(serverError => {
        console.error("Error in /api route processing sequence:", serverError);
        res.writeHead(HTTP_SERVER_ERROR, { "Content-Type": "text/plain" });
        res.end("An error occurred on the server while processing data. Check server console.");
    });
}

/**
 * Responsabilidade: Manipular requisições para '/stats'.
 * @param {http.ServerResponse} res - O objeto de resposta.
 */
function handleStatsRequest(res) {
    // As variáveis globais são acessadas aqui para construir o JSON.
    res.writeHead(HTTP_OK, { "Content-Type": "application/json" });
    res.end(
        JSON.stringify({
            api_call_sequences: fetch_count,
            cache_size: Object.keys(cache).length,
            data_size: total_size,
            errors: err_count,
            debug: debug_mode,
            timeout: timeout,
        })
    );
}

/**
 * Responsabilidade: Manipular requisições para rotas não encontradas.
 * @param {http.ServerResponse} res - O objeto de resposta.
 */
function handleNotFoundRequest(res) {
    res.writeHead(HTTP_NOT_FOUND, { "Content-Type": "text/plain" });
    res.end("Not Found");
}

// --- Servidor HTTP (Refatorado) ---
const server = http.createServer((req, res) => {
    logDebug(`Incoming request: ${req.method} ${req.url}`); // Adicionado log da requisição

    if (req.url === "/" || req.url === "/index.html") {
        handleRootRequest(res);
    } else if (req.url === "/api") {
        handleApiRequest(res);
    } else if (req.url === "/stats") {
        handleStatsRequest(res);
    } else {
        handleNotFoundRequest(res);
    }
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || DEFAULT_PORT;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log("Open the URL in your browser and click the button to fetch Star Wars data(results in server console)");
    if (debug_mode) {
        console.log("Debug mode: ON");
        console.log("Timeout:", timeout, "ms");
    }
});
