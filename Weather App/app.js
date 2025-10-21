const els = {
    form: document.getElementById('cityForm'),
    city: document.getElementById('city'),
    useLastBtn: document.getElementById('useLastBtn'),
    retryBtn: document.getElementById('retryBtn'),
    status: document.getElementById('status'),
    error: document.getElementById('error'),
    errorMsg: document.getElementById('errorMsg'),
    card: document.getElementById('card'),
    skeleton: document.getElementById('skeleton'),
    place: document.getElementById('place'),
    coords: document.getElementById('coords'),
    time: document.getElementById('time'),
    temp: document.getElementById('temp'),
    feels: document.getElementById('feels'),
    wind: document.getElementById('wind'),
    summary: document.getElementById('summary'),
};

// --- Constants ---
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

function withParams(baseUrl, params) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    return url.toString();
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} while requesting ${new URL(url).hostname}`);
    }
    return res.json();
}

async function fetchCityCoordinates(cityName) {
    const url = withParams(GEOCODE_URL, { name: cityName, count: 1, language: 'en', format: 'json' });
    const data = await fetchJSON(url);
    const first = data?.results?.[0];
    if (!first) {
        throw new Error(`No results for “${cityName}”.`);
    }
    const { name, country, admin1, latitude, longitude } = first;
    return { name, country, admin1, latitude, longitude };
}

async function fetchWeather({ latitude, longitude }) {
    const url = withParams(WEATHER_URL, {
        latitude,
        longitude,
        current_weather: true,
        timezone: 'auto'
    });
    const data = await fetchJSON(url);
    if (!data?.current_weather) {
        throw new Error('Weather data unavailable for that location.');
    }
    return simplifyWeatherResponse(data);
}
function simplifyWeatherResponse(apiData) {
    const cw = apiData.current_weather;
    const code = cw.weathercode;
    return {
        temperatureC: cw.temperature, // °C
        windKph: cw.windspeed,        // km/h
        isDay: cw.is_day === 1,
        summary: codeToSummary(code),
        timeISO: cw.time
    };
}

function codeToSummary(code) {
    const map = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        56: 'Light freezing drizzle',
        57: 'Dense freezing drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        66: 'Light freezing rain',
        67: 'Heavy freezing rain',
        71: 'Slight snow fall',
        73: 'Moderate snow fall',
        75: 'Heavy snow fall',
        77: 'Snow grains',
        80: 'Rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    return map[code] || `Weather code ${code}`;
}

function setStatus(text) { els.status.textContent = text || ''; }
function showError(message) {
    els.errorMsg.textContent = message || 'Unknown error';
    els.error.classList.remove('hidden');
}
function hideError() { els.error.classList.add('hidden'); els.errorMsg.textContent = ''; }
function showCard() { els.card.classList.remove('hidden'); }
function hideCard() { els.card.classList.add('hidden'); }
function showSkeleton() { els.skeleton.classList.remove('hidden'); }
function hideSkeleton() { els.skeleton.classList.add('hidden'); }

function displayWeather(place, coords, weather) {

    els.place.textContent = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}, ${place.country}`;
    els.coords.textContent = `lat ${coords.latitude.toFixed(2)}, lon ${coords.longitude.toFixed(2)}`;
    els.temp.textContent = Math.round(weather.temperatureC);
    els.feels.textContent = `${Math.round(weather.temperatureC)} °C`; // simple "feels like" proxy
    els.wind.textContent = `${Math.round(weather.windKph)} km/h`;
    els.summary.textContent = weather.summary;

    const dt = new Date(weather.timeISO);
    els.time.textContent = dt.toLocaleString();

    showCard();
}

async function getAndShowWeather(cityName) {
    try {
        hideError();
        hideCard();
        setStatus('Looking up city…');
        showSkeleton();

        const place = await fetchCityCoordinates(cityName);

        setStatus('Fetching current weather…');
        const weather = await fetchWeather({ latitude: place.latitude, longitude: place.longitude });

        hideSkeleton();
        displayWeather(place, { latitude: place.latitude, longitude: place.longitude }, weather);
        setStatus('');
        localStorage.setItem('sw.lastCity', cityName);
    } catch (err) {
        console.error(err);
        hideSkeleton();
        showError(err.message);
        setStatus('');
    }
}

// --- Event wiring ---
els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = els.city.value.trim();
    if (!city) {
        setStatus('Please enter a city name.');
        els.city.focus();
        return;
    }
    getAndShowWeather(city);
});

els.retryBtn.addEventListener('click', () => {
    const city = els.city.value.trim() || localStorage.getItem('sw.lastCity') || '';
    if (!city) {
        setStatus('Enter a city first.');
        els.city.focus();
        return;
    }
    getAndShowWeather(city);
});

els.useLastBtn.addEventListener('click', () => {
    const last = localStorage.getItem('sw.lastCity');
    if (last) {
        els.city.value = last;
        getAndShowWeather(last);
    } else {
        setStatus('No last city saved yet.');
    }
});

// Optional: try to load last city on first visit
window.addEventListener('DOMContentLoaded', () => {
    const last = localStorage.getItem('sw.lastCity');
    if (last) {
        els.city.value = last;
        getAndShowWeather(last);
    }
});
