// =====================================================================
// 3. ANZEIGE
// Baut die Seiten, reagiert auf Tippen und Regler, speichert Einstellungen.
// =====================================================================

import { fetchWeather, parseCurrent, parseHourly, getGpsPosition, getPlaceName, searchPlaces } from "./data.js";
import {
  buildQuickCheck, getRidingTemperature, getFeelBand, getClothingLevel, pickFromWardrobe,
  FEEL_BANDS, OUTFITS, CATALOG, ZONES, WARMTH_WORDS, RAIN_GEAR_ALL, GUSTS_STRONG,
} from "./logic.js";

// ---------------------------------------------------------------------
// Einstellungen (im Speicher des Handys)
// ---------------------------------------------------------------------

const STORAGE_KEY = "motoweather.settings.v1";
const REFRESH_AFTER_MS = 10 * 60 * 1000; // nach 10 Minuten neu laden

const DEFAULT_SETTINGS = {
  onboarded: false,
  sensitivity: 3,
  wardrobe: [
    "Halstuch", "Winter-Sturmhaube",
    "T-Shirt", "Langarm-Shirt", "Thermo-Shirt", "Pullover", "Jacke ohne Futter", "Jacke mit Futter",
    "Sommerhandschuhe", "Winterhandschuhe",
    "Motorradjeans", "Motorradhose", "Thermohose",
    "Motorradstiefel", "Thermosocken",
    "Regenkombi",
  ],
  useGps: true,
  manualPlace: { name: "Freising", region: "Bayern, Deutschland", latitude: 48.40, longitude: 11.74 },
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Speichern nicht möglich (z. B. privater Modus) - App läuft trotzdem
  }
}

// ---------------------------------------------------------------------
// Zustand der App
// ---------------------------------------------------------------------

const state = {
  settings: loadSettings(),
  view: "home",          // "home" oder "settings"
  draft: null,           // Kopie der Einstellungen, während man sie bearbeitet
  rideHours: 2,
  showDetails: false,
  openZone: null,
  weather: null,         // { current, hours, placeName, fetchedAt }
  loading: false,
  error: null,
  search: { query: "", results: [], busy: false, error: null },
};

const app = document.getElementById("app");

// ---------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function deg(value) {
  return String(Math.round(value)).replace("-", "−");
}

function clock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]} · ${clock(date)}`;
}

function formatHours(hours) {
  if (hours === 0.5) return "30 min";
  return `${String(hours).replace(".", ",")} h`;
}

// ---------------------------------------------------------------------
// Symbole
// ---------------------------------------------------------------------

const ICONS = {
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"></path><circle cx="12" cy="10" r="2.3"></circle>',
  sliders: '<line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="17" x2="20" y2="17"></line><circle cx="9" cy="7" r="2.5" fill="#191C21"></circle><circle cx="15" cy="17" r="2.5" fill="#191C21"></circle>',
  route: '<circle cx="6" cy="18" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"></path>',
  drop: '<path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"></path>',
  warning: '<path d="M12 3l9.5 17h-19z"></path><line x1="12" y1="10" x2="12" y2="14"></line><line x1="12" y1="17" x2="12" y2="17.01"></line>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  chevronDown: '<path d="M6 9l6 6 6-6"></path>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"></path>',
  thermometer: '<path d="M14 14.8V4.5a2 2 0 0 0-4 0v10.3a4 4 0 1 0 4 0z"></path>',
  head: '<circle cx="12" cy="9" r="5.5"></circle><path d="M7 21v-2.5a5 5 0 0 1 10 0V21"></path>',
  torso: '<path d="M8.5 3.5L4 5.5 2.5 11l3.2 1.2L7 10v10.5h10V10l1.3 2.2 3.2-1.2L20 5.5l-4.5-2a4 4 0 0 1-7 0z"></path>',
  hands: '<path d="M7.5 21v-4.5L5 12.5a1.6 1.6 0 0 1 2.6-1.8L9 12.5V5.5a1.5 1.5 0 0 1 3 0V11V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-1.5 4V21"></path>',
  legs: '<path d="M6.5 3h11l1 18h-5L12 10l-1.5 11h-5z"></path>',
  boots: '<path d="M7 3h6.5v9l5.3 2.4A2.2 2.2 0 0 1 20 16.4V20H5.5z"></path><path d="M5.5 17h14.5"></path>',
};

function icon(name, size = 20, color = "currentColor", width = 1.8) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

// ---------------------------------------------------------------------
// Wetter laden
// ---------------------------------------------------------------------

async function getLocation() {
  if (state.settings.useGps) {
    const position = await getGpsPosition();
    const placeName = await getPlaceName(position.latitude, position.longitude);
    return { ...position, placeName };
  }
  const place = state.settings.manualPlace;
  return { latitude: place.latitude, longitude: place.longitude, placeName: place.name };
}

async function loadWeather() {
  state.loading = true;
  state.error = null;
  render();

  try {
    const location = await getLocation();
    const raw = await fetchWeather(location.latitude, location.longitude);
    state.weather = {
      current: parseCurrent(raw),
      hours: parseHourly(raw),
      placeName: location.placeName,
      fetchedAt: new Date(),
    };
  } catch (error) {
    state.error = error.message || "Wetter konnte nicht geladen werden.";
  } finally {
    state.loading = false;
    render();
  }
}

// ---------------------------------------------------------------------
// Startseite
// ---------------------------------------------------------------------

function currentCheck() {
  const { current, hours } = state.weather;
  return buildQuickCheck(current, hours, new Date(), state.rideHours,
    state.settings.sensitivity, new Set(state.settings.wardrobe));
}

function renderHome() {
  const weather = state.weather;
  const placeName = weather ? weather.placeName : (state.settings.useGps ? "Mein Standort" : state.settings.manualPlace.name);

  let body;
  if (state.loading && !weather) {
    body = `<section class="card status-card"><div class="spinner" aria-hidden="true"></div><p>Wetter wird geladen …</p></section>`;
  } else if (state.error && !weather) {
    body = `<section class="card status-card">
      <p>${escapeHtml(state.error)}</p>
      <button class="secondary-button" data-action="retry">Nochmal versuchen</button>
      <button class="secondary-button" data-action="open-settings">Standort einstellen</button>
    </section>`;
  } else if (weather) {
    const check = currentCheck();
    body = renderHero(check) + renderRideShell() + `<section class="card" id="outfit"></section>`;
  } else {
    body = "";
  }

  const updated = weather ? `Aktualisiert ${clock(weather.fetchedAt)}` : "";

  app.innerHTML = `<div class="app">
    <header class="topbar">
      <div class="place">
        <div class="place-name">${icon("pin", 18, "var(--brand)", 2)}<span>${escapeHtml(placeName)}</span></div>
        <div class="place-date">${formatDate(new Date())}${updated ? ` · <button class="link-like" data-action="retry" style="background:none;border:0;padding:0;color:var(--muted);font-size:14px;text-decoration:underline">${updated}</button>` : ""}</div>
      </div>
      <button class="icon-button" data-action="open-settings" aria-label="Einstellungen">${icon("sliders")}</button>
    </header>
    ${body}
  </div>`;

  if (weather) updateRide();
}

function renderGauge(ridingTemperature, bandIndex) {
  const tMin = -10;
  const tMax = 35;
  const angle = (t) => Math.PI * (1 - (Math.max(tMin, Math.min(tMax, t)) - tMin) / (tMax - tMin));
  const point = (a, r) => [75 + r * Math.cos(a), 80 - r * Math.sin(a)];
  const f = (n) => Math.round(n * 10) / 10;
  const bounds = [-10, 5, 12, 18, 25, 30, 35];

  let arcs = "";
  FEEL_BANDS.forEach((band, i) => {
    const a1 = angle(bounds[i]) - (i === 0 ? 0 : 0.035);
    const a2 = angle(bounds[i + 1]) + (i === FEEL_BANDS.length - 1 ? 0 : 0.035);
    const [x1, y1] = point(a1, 62);
    const [x2, y2] = point(a2, 62);
    arcs += `<path d="M ${f(x1)} ${f(y1)} A 62 62 0 0 1 ${f(x2)} ${f(y2)}" stroke="${band.color}" opacity="${i === bandIndex ? 1 : 0.28}" stroke-width="10" fill="none"></path>`;
  });
  const [nx, ny] = point(angle(ridingTemperature), 48);

  return `<svg role="img" aria-label="Temperaturanzeige von sehr kalt bis heiß, Zeiger auf ${FEEL_BANDS[bandIndex].label}" width="156" height="92" viewBox="0 0 150 90">
    ${arcs}
    <line x1="75" y1="80" x2="${f(nx)}" y2="${f(ny)}" stroke="#F4F1EA" stroke-width="3.5" stroke-linecap="round"></line>
    <circle cx="75" cy="80" r="6" fill="#F4F1EA"></circle>
  </svg>`;
}

const HERO_COLORS = [
  ["#141D2A", "#2A3D57"], ["#12212B", "#24475C"], ["#122422", "#24504A"],
  ["#17221A", "#34502C"], ["#262013", "#5A4A1F"], ["#28180F", "#5E3220"],
];

function renderScene(kind) {
  const box = 'class="scene" aria-hidden="true" viewBox="0 0 358 270" preserveAspectRatio="xMidYMid slice"';
  if (kind === "frost") {
    const flake = "M0 -11V11M-9.5 -5.5L9.5 5.5M-9.5 5.5L9.5 -5.5";
    const spots = [[300, 44, 1], [246, 116, 0.7], [334, 140, 1.3], [200, 30, 0.6], [336, 236, 0.8], [186, 224, 0.55], [280, 204, 1]];
    return `<svg ${box}><g fill="none" stroke="#CFE3FF" stroke-width="1.6" opacity="0.24" stroke-linecap="round">
      ${spots.map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="${flake}"></path>`).join("")}
      <path d="M0 252 Q60 240 120 250 T240 246 T358 252"></path></g></svg>`;
  }
  if (kind === "rain") {
    return `<svg ${box}><g stroke="#6EC3F5" stroke-width="2" opacity="0.2" stroke-linecap="round">
      <path d="M200 20l-8 18M240 40l-8 18M280 16l-8 18M320 46l-8 18M220 90l-8 18M262 110l-8 18M304 84l-8 18M346 112l-8 18M190 160l-8 18M236 180l-8 18M282 156l-8 18M328 190l-8 18M260 226l-8 18M314 240l-8 18"></path></g></svg>`;
  }
  if (kind === "sun") {
    return `<svg ${box}><g fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.2" stroke-linecap="round">
      <circle cx="300" cy="150" r="26"></circle><path d="M300 108v-12M300 192v12M258 150h-12M342 150h12M270 120l-8-8M330 180l8 8M330 120l8-8M270 180l-8 8"></path>
      <path d="M0 230 Q90 190 180 215 T358 200"></path></g></svg>`;
  }
  // Standard: Landstraße in die Hügel
  return `<svg ${box}><g fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.2" stroke-linecap="round">
    <path d="M0 205 Q70 160 150 190 T358 168"></path><path d="M0 232 Q110 196 220 214 T358 200"></path>
    <path d="M200 270 L303 178"></path><path d="M358 250 L309 178"></path>
    <path d="M282 270 L306 178" stroke-dasharray="12 10"></path></g></svg>`;
}

function renderHero(check) {
  const now = check.now;
  const bandIndex = FEEL_BANDS.indexOf(now.band);
  const [bg, border] = HERO_COLORS[bandIndex];
  document.documentElement.style.setProperty("--accent", now.band.color);

  let scene = "road";
  if (now.ice || now.ridingTemperature < 3) scene = "frost";
  else if (state.weather.current.precipitation > 0) scene = "rain";
  else if (now.ridingTemperature >= 25) scene = "sun";

  const ice = now.ice ? `<div class="ice-banner">${icon("warning", 24, "#1A1408", 2)}
    <div><strong>Glättegefahr</strong><span>${now.iceUntil ? `Bis ca. ${now.iceUntil.getHours()} Uhr` : "Jetzt"} – Boden um 0 °C, Brücken und Schattenlagen</span></div></div>` : "";

  return `<section class="hero" style="background:${bg};border-color:${border}">
    ${renderScene(scene)}
    <div class="hero-top">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="now-badge">JETZT</span><span class="hero-caption">gefühlt auf dem Motorrad</span>
      </div>
      <div class="air-badge"><small>AUSSEN</small><strong>${deg(now.airTemperature)}°</strong></div>
    </div>
    <div class="hero-main">
      <div class="big-temp">${deg(now.ridingTemperature)}°</div>
      <div class="gauge-wrap">${renderGauge(now.ridingTemperature, bandIndex)}<div class="feel-label">${now.band.label}</div></div>
    </div>
    ${ice}
  </section>`;
}

const SLIDER_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
const SLIDER_LABELS = [[0.5, "30 min"], [2, "2 h"], [4, "4 h"], [6, "6 h"], [8, "8 h"]];

function renderRideShell() {
  return `<section class="card ride">
    <div class="ride-head">
      <div style="display:flex;flex-direction:column;gap:3px">
        <div class="eyebrow">${icon("route", 16, "currentColor", 2)}Deine Fahrt</div>
        <label for="ride-hours" class="ride-question">Wie lange fährst du?</label>
      </div>
      <div class="ride-value"><strong id="hours-text"></strong><span class="muted" id="end-text"></span></div>
    </div>
    <input id="ride-hours" type="range" min="0.5" max="8" step="0.5" value="${state.rideHours}">
    <div class="ticks" aria-hidden="true">${SLIDER_STEPS.map((v) => `<span data-v="${v}" class="${v % 1 === 0 ? "full" : ""}"></span>`).join("")}</div>
    <div class="tick-labels" aria-hidden="true">${SLIDER_LABELS.map(([v, text]) => `<span data-v="${v}" style="left:${((v - 0.5) / 7.5) * 100}%">${text}</span>`).join("")}</div>
    <div id="ride-dynamic"></div>
    <button class="details-toggle" data-action="toggle-details" aria-expanded="${state.showDetails}">
      <span>${state.showDetails ? "Weniger anzeigen" : "Regen & Wind im Verlauf"}</span>${icon("chevronDown", 16, "currentColor", 2.2)}
    </button>
  </section>`;
}

// Alles, was vom Regler abhängt - wird beim Ziehen neu gezeichnet, ohne den Regler selbst anzufassen
function updateRide() {
  const check = currentCheck();
  const ride = check.ride;

  document.getElementById("hours-text").textContent = formatHours(state.rideHours);
  document.getElementById("end-text").textContent = `bis ${clock(ride.end)}`;
  document.getElementById("ride-hours").setAttribute("aria-valuetext", formatHours(state.rideHours));
  app.querySelectorAll(".ticks span, .tick-labels span").forEach((el) => {
    el.classList.toggle("on", Number(el.dataset.v) <= state.rideHours);
  });

  // Hinweise
  const hints = [];
  if (ride.iceLater) {
    hints.push(`<div class="hint ice">${icon("warning", 22, "var(--ice)", 2)}<strong>Glättegefahr ab ca. ${ride.iceLater.getHours()} Uhr</strong></div>`);
  }
  if (ride.rain) {
    hints.push(`<div class="hint rain">${icon("drop", 22, "var(--rain)")}<div><strong>${ride.rain.title}</strong><span>${ride.rain.sub}</span></div></div>`);
  }
  if (ride.wind) {
    const bars = [1, 2, 3].map((i) => `<i class="${i <= ride.windLevel ? "on" : ""}" style="height:${5 + i * 4}px"></i>`).join("");
    hints.push(`<div class="hint wind"><span class="wind-bars" aria-hidden="true">${bars}</span><div><strong>${ride.wind.title}</strong><span>${ride.wind.sub}</span></div></div>`);
  }
  if (!hints.length) {
    hints.push(`<div class="calm">${icon("check", 18, "#9FDB6B", 2)}<span>Bis ${clock(ride.end)}: trocken · ${ride.windLevel === 1 ? "kaum Wind" : "etwas Wind"}</span></div>`);
  }

  // Verlauf
  const coldestPoint = ride.timeline.filter((p) => p.inRide)
    .reduce((min, p) => (!min || p.ridingTemperature < min.ridingTemperature ? p : min), null);

  const cells = (inner) => ride.timeline.map((p) => `<div class="cell ${p.inRide ? "" : "off"}">${inner(p)}</div>`).join("");

  const tempRow = cells((p) => {
    const color = getFeelBand(p.ridingTemperature).color;
    return `<div class="cell-time">${String(p.time.getHours()).padStart(2, "0")}:00</div>
      <div class="cell-mark" style="background:${p.inRide ? color : "transparent"}"></div>
      <div class="cell-temp" style="color:${color}${p === coldestPoint ? ";text-decoration:underline" : ""}">${deg(p.ridingTemperature)}°</div>`;
  });

  let details = "";
  if (state.showDetails) {
    const rainRow = cells((p) => `<div class="rain-bar"><i style="height:${Math.round(p.rainProbability / 100 * 28)}px"></i></div>
      <div class="rain-value ${p.rainProbability >= 30 ? "high" : ""}">${p.rainProbability}</div>`);
    const gustRow = cells((p) => `<div class="gust ${p.gusts >= GUSTS_STRONG ? "strong" : ""}">${Math.round(p.gusts)}</div>`);
    details = `<div class="row-title" style="color:var(--rain)">Regen %</div><div class="timeline-row">${rainRow}</div>
      <div class="row-title" style="color:var(--wind)">Böen km/h</div><div class="timeline-row">${gustRow}</div>`;
  }

  document.getElementById("ride-dynamic").innerHTML = `<div class="hints">${hints.join("")}</div>
    <div class="timeline"><div class="timeline-row">${tempRow}</div>${details}</div>`;

  renderOutfit(check);
}

function renderOutfit(check) {
  const outfit = check.outfit;
  const ride = check.ride;
  const warmthClass = (w) => `w${w}`;

  const tiles = outfit.zones.map((zone) => {
    const layers = zone.layers;
    const open = state.openZone === zone.key && layers.length > 1;
    const outer = layers[layers.length - 1];
    const strip = (layers.length ? layers : [null]).map((l) => `<i class="${l ? warmthClass(l.warmth) : ""}"></i>`).join("");

    let meta = "";
    if (layers.length > 1) {
      const n = layers.length - 1;
      meta = `<span class="more-badge">+${n}</span><span>${n === 1 ? "Schicht" : "Schichten"} darunter</span>`;
    } else if (layers.length === 1) {
      meta = `<span class="muted">${outer.missing ? "nicht im Kleiderschrank" : WARMTH_WORDS[outer.warmth]}</span>`;
    }

    return `<button class="tile" data-action="toggle-zone" data-zone="${zone.key}" aria-expanded="${open}">
      <span class="tile-zone">${icon(zone.key, 22, "#C3C7CD")}${zone.name}</span>
      <span class="tile-item ${layers.length ? "" : "empty"}">${outer ? escapeHtml(outer.name) : "Nichts extra"}</span>
      <span class="tile-meta">${meta}</span>
      <span class="strip">${strip}</span>
    </button>`;
  });

  // Regen-Kachel
  const gear = outfit.rainGear;
  tiles.push(`<div class="tile ${gear ? "rain-on" : ""}">
    <span class="tile-zone">${icon("drop", 22, gear ? "var(--rain)" : "#6E747D")}Regen</span>
    <span class="tile-item ${gear ? "" : "empty"}">${gear ? escapeHtml(gear.name) : "Nicht nötig"}</span>
    <span class="tile-meta"><span class="muted">${gear ? (gear.missing ? "nicht im Kleiderschrank" : (ride.rainSoonestHour !== null ? `Regen ab ${ride.rainSoonestHour} Uhr` : "mitnehmen")) : "trocken unterwegs"}</span></span>
    <span class="strip"><i class="${gear ? "w0" : ""}"></i></span>
  </div>`);

  let detail = "";
  const openZone = outfit.zones.find((z) => z.key === state.openZone && z.layers.length > 1);
  if (openZone) {
    const rows = [...openZone.layers].reverse().map((l) => `<div class="layer">
      <span class="swatch ${warmthClass(l.warmth)}"></span>
      <span class="name">${escapeHtml(l.name)}</span>
      <span class="word ${warmthClass(l.warmth)}">${WARMTH_WORDS[l.warmth]}</span></div>`).join("");
    detail = `<div class="layer-detail"><div class="label-small">${openZone.name} · von außen nach innen</div>${rows}</div>`;
  }

  document.getElementById("outfit").innerHTML = `
    <div class="outfit-head">
      <div class="eyebrow">${icon("torso", 16, "currentColor", 2)}Anziehen</div>
      <div class="hint-text">für ${deg(ride.coldest)}° im kältesten Moment</div>
    </div>
    <div class="tiles">${tiles.join("")}</div>
    ${detail}
    <div class="legend">
      <span><i class="w1"></i>leicht</span><span><i class="w2"></i>warm</span><span><i class="w3"></i>winterfest</span>
    </div>
    ${outfit.tip ? `<div class="tip">${outfit.tip}</div>` : ""}`;
}

// ---------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------

const LEVEL_COLORS = ["#8FB8FF", "#62C1F5", "#9FDB6B", "#FFC94A", "#FF7A45"];
const LEVEL_INFO = [
  ["Fröstelt schnell", "Du frierst früh. Wir empfehlen dir deutlich wärmere Kleidung, meist eine Schicht mehr."],
  ["Eher verfroren", "Du magst es lieber etwas wärmer. Wir empfehlen dir etwas wärmere Kleidung."],
  ["Normal", "Wir empfehlen Kleidung, die für die meisten Fahrer passt."],
  ["Robust", "Kälte macht dir wenig aus. Wir empfehlen dir etwas leichtere Kleidung."],
  ["Friert nie", "Kälte? Welche Kälte? Wir empfehlen dir deutlich leichtere Kleidung, meist eine Schicht weniger."],
];

const WARDROBE_GROUPS = [
  ...ZONES.map((zone) => ({
    key: zone.key,
    name: zone.name,
    items: Object.entries(CATALOG).filter(([, info]) => info[0] === zone.key).map(([name, info]) => ({ name, warmth: info[2] })),
  })),
  { key: "rain", name: "Regen", items: RAIN_GEAR_ALL.map((name) => ({ name, warmth: 0 })) },
];

function openSettings() {
  state.draft = JSON.parse(JSON.stringify(state.settings));
  state.search = { query: "", results: [], busy: false, error: null };
  state.view = "settings";
  render();
  window.scrollTo(0, 0);
}

function renderExample(draft) {
  // Beispiel mit der aktuellen Fahrtemperatur (oder 10 °C, solange kein Wetter da ist)
  const riding = state.weather ? getRidingTemperature(state.weather.current.temperature) : 10;
  const baseLevel = getClothingLevel(riding, 3);
  const level = getClothingLevel(riding, draft.sensitivity);
  const wardrobe = new Set(draft.wardrobe);

  const items = [];
  for (const item of OUTFITS[level].torso) {
    const picked = pickFromWardrobe(item, wardrobe);
    if (picked && !items.some((i) => i.name === picked.name)) items.push({ name: picked.name, warmth: CATALOG[picked.name][2] });
  }
  const chips = items.map((it, i) => `${i ? '<span class="muted" aria-hidden="true">+</span>' : ""}<span class="chip-static"><span class="dot w${it.warmth}"></span>${escapeHtml(it.name)}</span>`).join("");

  const stuck = (draft.sensitivity > 3 && level === 1 && baseLevel === 1) || (draft.sensitivity < 3 && level === 5 && baseLevel === 5);
  const note = stuck ? `<span class="hint-text">Bei dieser Temperatur macht die Einstellung keinen Unterschied – das zeigt sich an anderen Tagen.</span>` : "";

  return `<div class="example">
    <span class="hint-text">Beispiel: Bei ${deg(riding)}° auf dem Motorrad empfehlen wir dir oben herum</span>
    <div class="chips">${chips}</div>${note}</div>`;
}

function renderSettings() {
  const draft = state.draft;
  const onboarding = !state.settings.onboarded;
  const levelColor = LEVEL_COLORS[draft.sensitivity - 1];
  const [levelTitle, levelText] = LEVEL_INFO[draft.sensitivity - 1];
  const wardrobe = new Set(draft.wardrobe);

  const levels = [1, 2, 3, 4, 5].map((n) => {
    const on = n === draft.sensitivity;
    const color = LEVEL_COLORS[n - 1];
    return `<button class="level" data-action="set-level" data-level="${n}" aria-pressed="${on}" aria-label="Stufe ${n}: ${LEVEL_INFO[n - 1][0]}"
      style="${on ? `background:${color};border-color:${color}` : `color:${color}`}">${n}</button>`;
  }).join("");

  const groups = WARDROBE_GROUPS.map((group) => {
    const count = group.items.filter((it) => wardrobe.has(it.name)).length;
    const chips = group.items.map((it) => `<button class="chip" data-action="toggle-item" data-item="${escapeHtml(it.name)}" aria-pressed="${wardrobe.has(it.name)}">
      <span class="dot w${it.warmth}"></span>${escapeHtml(it.name)}${wardrobe.has(it.name) ? icon("check", 14, "#F4F1EA", 3) : ""}</button>`).join("");
    const groupIcon = group.key === "rain" ? icon("drop", 20, "var(--rain)") : icon(group.key, 20, "#C3C7CD");
    return `<div class="category">
      <div class="category-head"><span class="category-name">${groupIcon}${group.name}</span><span class="hint-text">${count} von ${group.items.length}</span></div>
      <div class="chips">${chips}</div></div>`;
  }).join("");

  const search = state.search;
  const manualBlock = draft.useGps ? "" : `
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="hint-text">Aktuell: <strong style="color:var(--text)">${escapeHtml(draft.manualPlace.name)}</strong>${draft.manualPlace.region ? ` · ${escapeHtml(draft.manualPlace.region)}` : ""}</div>
      <form class="search" data-action="search">
        <label for="place-search" class="visually-hidden">Ort suchen</label>
        <input id="place-search" class="text-input" type="search" placeholder="Ort suchen, z. B. Kassel" value="${escapeHtml(search.query)}" autocomplete="off">
        <button class="secondary-button" type="submit">${search.busy ? "…" : "Suchen"}</button>
      </form>
      ${search.error ? `<div class="hint-text">${escapeHtml(search.error)}</div>` : ""}
      <div class="results">${search.results.map((place, i) => `<button class="result" data-action="pick-place" data-index="${i}" aria-pressed="${place.latitude === draft.manualPlace.latitude && place.longitude === draft.manualPlace.longitude}">
        <span>${escapeHtml(place.name)}</span><small>${escapeHtml(place.region)}</small></button>`).join("")}</div>
    </div>`;

  app.innerHTML = `<div class="app">
    <header class="page-head">
      ${onboarding ? "" : `<button class="icon-button" data-action="close-settings" aria-label="Zurück">${icon("chevronLeft", 20, "currentColor", 2.2)}</button>`}
      <div><div class="page-title">${onboarding ? "Willkommen" : "Einstellungen"}</div>
      <div class="hint-text">${onboarding ? "Kurz einrichten, damit die Empfehlungen zu dir passen" : "Damit die Empfehlungen zu dir passen"}</div></div>
    </header>

    <section class="card">
      <div class="eyebrow">${icon("pin", 16, "currentColor", 2)}Standort</div>
      <div class="switch-row">
        <div><div class="question">Automatisch per GPS</div>
        <div class="hint-text">${draft.useGps ? "Beim Öffnen wird dein Standort abgefragt" : "Aus – fester Ort wird genutzt"}</div></div>
        <button class="switch" data-action="toggle-gps" aria-pressed="${draft.useGps}" aria-label="Standort automatisch per GPS"></button>
      </div>
      ${manualBlock}
    </section>

    <section class="card">
      <div class="eyebrow">${icon("thermometer", 16, "currentColor", 2)}Kälteempfinden</div>
      <div class="question">Wie schnell frierst du auf dem Motorrad?</div>
      <div class="levels">${levels}</div>
      <div class="level-ends"><span>friert schnell</span><span>friert nie</span></div>
      <div class="level-info" style="border-color:${levelColor}">
        <div class="level-title" style="color:${levelColor}">${levelTitle}</div>
        <div class="level-text">${levelText}</div>
        ${renderExample(draft)}
      </div>
    </section>

    <section class="card">
      <div class="outfit-head"><div class="eyebrow">${icon("torso", 16, "currentColor", 2)}Kleiderschrank</div><div class="hint-text">${draft.wardrobe.length} Teile ausgewählt</div></div>
      <div class="question">Was hast du davon?</div>
      <div class="hint-text" style="margin-top:-6px">Antippen zum An- und Abwählen. Empfohlen wird nur, was du auch besitzt.</div>
      ${groups}
      <div class="legend" style="padding-top:10px;border-top:1px solid var(--card-border)">
        <span><i class="w1"></i>leicht</span><span><i class="w2"></i>warm</span><span><i class="w3"></i>winterfest</span><span><i class="w0"></i>Regen</span>
      </div>
    </section>

    <button class="primary-button" data-action="save-settings">${onboarding ? "Los geht's" : "Speichern"}</button>
  </div>`;
}

async function runSearch(query) {
  state.search = { query, results: [], busy: true, error: null };
  render();
  try {
    const results = await searchPlaces(query);
    state.search = { query, results, busy: false, error: results.length ? null : "Kein Ort gefunden." };
  } catch {
    state.search = { query, results: [], busy: false, error: "Suche gerade nicht möglich." };
  }
  render();
}

function saveAndClose() {
  const before = state.settings;
  const after = { ...state.draft, onboarded: true };
  const locationChanged = before.useGps !== after.useGps
    || before.manualPlace.latitude !== after.manualPlace.latitude
    || before.manualPlace.longitude !== after.manualPlace.longitude;

  state.settings = after;
  saveSettings(after);
  state.view = "home";
  state.draft = null;

  if (locationChanged || !state.weather) loadWeather();
  else render();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------
// Bedienung
// ---------------------------------------------------------------------

function render() {
  if (state.view === "settings") renderSettings();
  else renderHome();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.tagName === "FORM") return;
  const action = target.dataset.action;

  if (action === "open-settings") openSettings();
  if (action === "close-settings") { state.view = "home"; render(); }
  if (action === "retry") loadWeather();
  if (action === "toggle-details") { state.showDetails = !state.showDetails; renderHome(); }
  if (action === "toggle-zone") {
    const zone = target.dataset.zone;
    state.openZone = state.openZone === zone ? null : zone;
    updateRide();
  }
  if (action === "set-level") { state.draft.sensitivity = Number(target.dataset.level); renderSettings(); }
  if (action === "toggle-item") {
    const name = target.dataset.item;
    const set = new Set(state.draft.wardrobe);
    if (set.has(name)) set.delete(name); else set.add(name);
    state.draft.wardrobe = [...set];
    renderSettings();
  }
  if (action === "toggle-gps") { state.draft.useGps = !state.draft.useGps; renderSettings(); }
  if (action === "pick-place") {
    const place = state.search.results[Number(target.dataset.index)];
    state.draft.manualPlace = place;
    renderSettings();
  }
  if (action === "save-settings") saveAndClose();
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = app.querySelector("#place-search").value.trim();
  if (query) runSearch(query);
});

// Regler: nur den Fahrt- und Kleidungsteil neu zeichnen, damit das Ziehen flüssig bleibt
app.addEventListener("input", (event) => {
  if (event.target.id === "ride-hours") {
    state.rideHours = Number(event.target.value);
    state.openZone = null;
    updateRide();
  }
});

// Wieder geöffnet und Daten älter als 10 Minuten? Neu laden.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || state.view !== "home" || state.loading) return;
  if (!state.weather || Date.now() - state.weather.fetchedAt.getTime() > REFRESH_AFTER_MS) loadWeather();
});

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------

if (state.settings.onboarded) {
  loadWeather();
} else {
  // Ersteinrichtung: Einstellungen zeigen. Wetter für das Beispiel lädt im Hintergrund,
  // aber nur mit festem Ort - nach GPS fragen wir erst, wenn man auf "Los geht's" tippt.
  openSettings();
  if (!state.settings.useGps) loadWeather().then(() => { if (state.view === "settings") renderSettings(); });
}
