// =====================================================================
// 1. DATENQUELLE
// Nur dieser Teil kennt Open-Meteo und die Standort-Dienste.
// Alles danach arbeitet mit unserem eigenen Format.
// =====================================================================

const REQUEST_TIMEOUT_MS = 10000;

// Unser Name -> Name bei Open-Meteo (gibt es aktuell UND stündlich)
const VARIABLES = {
  temperature: "temperature_2m",
  humidity: "relative_humidity_2m",
  windSpeed: "wind_speed_10m",
  windGusts: "wind_gusts_10m",
  precipitation: "precipitation",
  weatherCode: "weather_code",
  radiation: "shortwave_radiation",   // Sonneneinstrahlung in W/m² (für die Fahrtemperatur)
};

// Nur stündlich
const HOURLY_EXTRAS = {
  rainProbability: "precipitation_probability",
  groundTemp: "soil_temperature_0cm",
  dewPoint: "dew_point_2m",
};

async function getJson(url) {
  // Wie timeout= in Python: nach 10 Sekunden abbrechen
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Anfrage fehlgeschlagen (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------
// Wetter
// ---------------------------------------------------------------------

export async function fetchWeather(latitude, longitude) {
  const parameters = new URLSearchParams({
    latitude,
    longitude,
    current: Object.values(VARIABLES).join(","),
    hourly: [...Object.values(VARIABLES), ...Object.values(HOURLY_EXTRAS)].join(","),
    timezone: "auto",   // Zeiten in der Zeitzone des Standorts
    forecast_days: 2,   // damit 8 Stunden auch abends über Mitternacht reichen
  });
  return getJson(`https://api.open-meteo.com/v1/forecast?${parameters}`);
}

export function parseCurrent(raw) {
  const data = { time: new Date(raw.current.time) };
  for (const [ourName, apiName] of Object.entries(VARIABLES)) {
    data[ourName] = raw.current[apiName];
  }
  return data;
}

export function parseHourly(raw) {
  const hourly = raw.hourly;
  return hourly.time.map((timeString, i) => {
    const hour = { time: new Date(timeString) };
    for (const [ourName, apiName] of Object.entries(VARIABLES)) {
      hour[ourName] = hourly[apiName][i];
    }
    for (const [ourName, apiName] of Object.entries(HOURLY_EXTRAS)) {
      hour[ourName] = hourly[apiName] ? hourly[apiName][i] : null;
    }
    hour.rainProbability = hour.rainProbability ?? 0; // fehlend = 0
    hour.precipitation = hour.precipitation ?? 0;
    return hour;
  });
}

// ---------------------------------------------------------------------
// Standort
// ---------------------------------------------------------------------

// GPS des Handys - fragt beim ersten Mal um Erlaubnis
export function getGpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("gpsUnsupported")); // Fehler-Schlüssel, den die Anzeige übersetzt
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => reject(new Error(error.code === 1 ? "gpsDenied" : "gpsFailed")),
      { enableHighAccuracy: false, timeout: REQUEST_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// Ortsname zu GPS-Koordinaten (für die Anzeige oben). Klappt das nicht, kommt null zurück.
export async function getPlaceName(latitude, longitude, language) {
  try {
    const parameters = new URLSearchParams({ latitude, longitude, localityLanguage: language });
    const data = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?${parameters}`);
    return data.city || data.locality || null;
  } catch {
    return null;
  }
}

// Ortssuche für den festen Standort (Open-Meteo Geocoding).
// Wichtig: nur den Ortsnamen schicken, ohne ", Deutschland".
export async function searchPlaces(name, language) {
  const parameters = new URLSearchParams({ name, count: 5, language, format: "json" });
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
  return (data.results || []).map((place) => ({
    name: place.name,
    region: [place.admin1, place.country].filter(Boolean).join(", "),
    latitude: place.latitude,
    longitude: place.longitude,
  }));
}
