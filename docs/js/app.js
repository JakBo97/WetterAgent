// =====================================================================
// 3. ANZEIGE
// Baut die Seiten, reagiert auf Tippen und Regler, speichert Einstellungen.
// =====================================================================

import { fetchWeather, parseCurrent, parseHourly, getGpsPosition, getPlaceName, searchPlaces } from "./data.js";
import {
  buildQuickCheck, getRidingTemperature, getFeelBand, getClothingLevel, pickFromWardrobe,
  FEEL_BANDS, OUTFITS, CATALOG, ZONES, RAIN_GEAR_ALL, GUSTS_STRONG,
} from "./logic.js";
import { t, itemName, setLanguage, guessLanguage, LANGUAGES } from "./i18n.js";

// ---------------------------------------------------------------------
// Einstellungen (im Speicher des Handys)
// ---------------------------------------------------------------------

const STORAGE_KEY = "motoweather.settings.v1";
const REFRESH_AFTER_MS = 10 * 60 * 1000; // nach 10 Minuten neu laden

const RIDE_MIN = 1;
const RIDE_MAX = 8;
const RIDE_DEFAULT = 1;

const DEFAULT_SETTINGS = {
  onboarded: false,
  language: guessLanguage(),
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
  rideHours: RIDE_DEFAULT,
  showDetails: false,
  openZone: null,
  weather: null,         // { current, hours, placeName, fetchedAt }
  loading: false,
  error: null,
  search: { query: "", results: [], busy: false, error: null },
};

setLanguage(state.settings.language);
const app = document.getElementById("app");

// ---------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------

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
  return t("dateFormat", t("weekdays")[date.getDay()], date.getDate(), t("months")[date.getMonth()], clock(date));
}

function formatHours(hours) {
  const text = state.settings.language === "de" ? String(hours).replace(".", ",") : String(hours);
  return `${text} h`;
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
  globe: '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path>',
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
    const placeName = await getPlaceName(position.latitude, position.longitude, state.settings.language);
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
    const known = ["gpsUnsupported", "gpsDenied", "gpsFailed"];
    state.error = known.includes(error.message) ? t(error.message) : t("loadError");
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
  let placeName;
  if (weather) placeName = weather.placeName || t("myLocation");
  else placeName = state.settings.useGps ? t("myLocation") : state.settings.manualPlace.name;

  let body = "";
  if (state.loading && !weather) {
    body = `<section class="card status-card"><div class="spinner" aria-hidden="true"></div><p>${t("loading")}</p></section>`;
  } else if (state.error && !weather) {
    body = `<section class="card status-card">
      <p>${escapeHtml(state.error)}</p>
      <button class="secondary-button" data-action="retry">${t("retry")}</button>
      <button class="secondary-button" data-action="open-settings">${t("setLocation")}</button>
    </section>`;
  } else if (weather) {
    body = renderHero(currentCheck()) + renderRideShell() + `<section class="card" id="outfit"></section>`;
  }

  const updated = weather
    ? ` · <button class="text-button" data-action="retry">${t("updated", clock(weather.fetchedAt))}</button>`
    : "";

  app.innerHTML = `<div class="app">
    <header class="topbar">
      <div class="place">
        <div class="place-name">${icon("pin", 18, "var(--brand)", 2)}<span>${escapeHtml(placeName)}</span></div>
        <div class="place-date">${formatDate(new Date())}${updated}</div>
      </div>
      <button class="icon-button" data-action="open-settings" aria-label="${t("settings")}">${icon("sliders")}</button>
    </header>
    ${body}
  </div>`;

  if (weather) updateRide();
}

function renderGauge(ridingTemperature, bandIndex) {
  const tMin = -10;
  const tMax = 35;
  const angle = (temp) => Math.PI * (1 - (Math.max(tMin, Math.min(tMax, temp)) - tMin) / (tMax - tMin));
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

  return `<svg role="img" aria-label="${t("gaugeLabel", t("bands")[bandIndex])}" width="156" height="92" viewBox="0 0 150 90">
    ${arcs}
    <line x1="75" y1="80" x2="${f(nx)}" y2="${f(ny)}" stroke="#F4F1EA" stroke-width="3.5" stroke-linecap="round"></line>
    <circle cx="75" cy="80" r="6" fill="#F4F1EA"></circle>
  </svg>`;
}

const HERO_COLORS = [
  ["#141D2A", "#2A3D57"], ["#12212B", "#24475C"], ["#122422", "#24504A"],
  ["#17221A", "#34502C"], ["#262013", "#5A4A1F"], ["#28180F", "#5E3220"],
];

// Hintergrund der Jetzt-Kachel: Bergkette, davor Hügel - plus je nach Wetter Straße, Schnee, Regen oder Sonne
function renderScene(kind) {
  const color = kind === "frost" ? "#CFE3FF" : (kind === "rain" ? "#6EC3F5" : "var(--accent)");

  const backRange = "M0 150 L28 128 L52 140 L92 92 L118 112 L160 58 L190 96 L214 80 L246 118 L284 70 L318 102 L340 88 L358 98";
  const frontRange = "M0 196 L46 168 L80 182 L128 140 L166 170 L206 150 L250 178 L296 146 L334 172 L358 160";
  const snowCaps = "M150 72 L160 58 L171 74 M82 104 L92 92 L102 103 M274 82 L284 70 L295 84";
  const close = " L358 270 L0 270 Z";

  let extra = "";
  if (kind === "frost") {
    const flake = "M0 -11V11M-9.5 -5.5L9.5 5.5M-9.5 5.5L9.5 -5.5";
    const spots = [[300, 34, 1], [236, 30, 0.6], [334, 130, 1.1], [200, 120, 0.7], [320, 226, 0.8], [180, 220, 0.55], [270, 200, 0.9]];
    extra = spots.map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="${flake}" stroke="#CFE3FF" stroke-width="1.6" opacity="0.35"></path>`).join("");
  } else if (kind === "rain") {
    extra = `<path d="M200 20l-8 18M240 40l-8 18M280 16l-8 18M320 46l-8 18M220 90l-8 18M262 110l-8 18M304 84l-8 18M346 112l-8 18M190 160l-8 18M236 180l-8 18M282 156l-8 18M328 190l-8 18" stroke="#6EC3F5" stroke-width="2" opacity="0.35"></path>`;
  } else if (kind === "sun") {
    extra = `<circle cx="214" cy="40" r="18" stroke="${color}" stroke-width="2" opacity="0.35"></circle>
      <path d="M214 12v-8M214 68v8M186 40h-8M242 40h8M194 20l-6-6M234 60l6 6M234 20l6-6M194 60l-6 6" stroke="${color}" stroke-width="2" opacity="0.35"></path>`;
  }

  // Straße, die zwischen den Bergen verschwindet
  const road = kind === "frost" ? "" : `<g stroke="${color}" stroke-width="2" opacity="0.32">
    <path d="M196 270 L292 176"></path><path d="M358 252 L300 176"></path>
    <path d="M276 270 L296 178" stroke-dasharray="12 10"></path></g>`;

  return `<svg class="scene" aria-hidden="true" viewBox="0 0 358 270" preserveAspectRatio="xMidYMid slice">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 22)">
      <path d="${backRange}${close}" fill="${color}" opacity="0.06"></path>
      <path d="${backRange}" stroke="${color}" stroke-width="2" opacity="0.28"></path>
      <path d="${snowCaps}" stroke="${color}" stroke-width="2" opacity="0.45"></path>
      <path d="${frontRange}${close}" fill="${color}" opacity="0.08"></path>
      <path d="${frontRange}" stroke="${color}" stroke-width="2" opacity="0.32"></path>
      ${road}${extra}
    </g>
  </svg>`;
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
    <div><strong>${t("iceTitle")}</strong><span>${now.iceUntil ? t("iceUntil", t("atHour", now.iceUntil.getHours())) : t("iceNow")} – ${t("iceText")}</span></div></div>` : "";

  return `<section class="hero" style="background:${bg};border-color:${border}">
    ${renderScene(scene)}
    <div class="hero-top">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="now-badge"><span class="live-dot" aria-hidden="true"></span>${t("now")}</span><span class="hero-caption">${t("feltOnBike")}</span>
      </div>
      <div class="air-badge"><small>${t("outside")}</small><strong>${deg(now.airTemperature)}°</strong></div>
    </div>
    <div class="hero-main">
      <div class="big-temp">${deg(now.ridingTemperature)}°</div>
      <div class="gauge-wrap">${renderGauge(now.ridingTemperature, bandIndex)}<div class="feel-label">${t("bands")[bandIndex]}</div></div>
    </div>
    ${ice}
  </section>`;
}

const SLIDER_STEPS = [];
for (let v = RIDE_MIN; v <= RIDE_MAX; v += 0.5) SLIDER_STEPS.push(v);
const SLIDER_LABELS = [1, 2, 4, 6, 8];

function renderRideShell() {
  const position = (v) => ((v - RIDE_MIN) / (RIDE_MAX - RIDE_MIN)) * 100;
  return `<section class="card ride">
    <div class="ride-head">
      <div style="display:flex;flex-direction:column;gap:3px">
        <div class="eyebrow">${icon("route", 16, "currentColor", 2)}${t("yourRide")}</div>
        <label for="ride-hours" class="ride-question">${t("howLong")}</label>
      </div>
      <div class="ride-value"><strong id="hours-text"></strong><span class="muted" id="end-text"></span></div>
    </div>
    <input id="ride-hours" type="range" min="${RIDE_MIN}" max="${RIDE_MAX}" step="0.5" value="${state.rideHours}">
    <div class="ticks" aria-hidden="true">${SLIDER_STEPS.map((v) => `<span data-v="${v}" class="${v % 1 === 0 ? "full" : ""}"></span>`).join("")}</div>
    <div class="tick-labels" aria-hidden="true">${SLIDER_LABELS.map((v) => `<span data-v="${v}" style="left:${position(v)}%">${v} h</span>`).join("")}</div>
    <div id="ride-dynamic"></div>
    <button class="details-toggle" data-action="toggle-details" aria-expanded="${state.showDetails}">
      <span>${state.showDetails ? t("hideDetails") : t("showDetails")}</span>${icon("chevronDown", 16, "currentColor", 2.2)}
    </button>
  </section>`;
}

function rainText(rain) {
  if (rain.kind === "now") return [t("rainNow"), t("rainNowSub")];
  if (rain.kind === "from") return [t("rainFrom", t("atHour", rain.hour)), t("rainFromSub", rain.probability)];
  return [t("rainPossible"), t("rainPossibleSub", rain.probability)];
}

function windText(wind) {
  const title = wind.kind === "now" ? t("windNow") : t("windFrom", t("atHour", wind.hour));
  return [title, t("windSub", wind.maxGusts)];
}

// Alles, was vom Regler abhängt - wird beim Ziehen neu gezeichnet, ohne den Regler selbst anzufassen
function updateRide() {
  const check = currentCheck();
  const ride = check.ride;

  document.getElementById("hours-text").textContent = formatHours(state.rideHours);
  document.getElementById("end-text").textContent = t("until", clock(ride.end));
  document.getElementById("ride-hours").setAttribute("aria-valuetext", formatHours(state.rideHours));
  app.querySelectorAll(".ticks span, .tick-labels span").forEach((el) => {
    el.classList.toggle("on", Number(el.dataset.v) <= state.rideHours);
  });

  // Hinweise
  const hints = [];
  if (ride.iceLater) {
    hints.push(`<div class="hint ice">${icon("warning", 22, "var(--ice)", 2)}<strong>${t("iceFrom", t("atHour", ride.iceLater.getHours()))}</strong></div>`);
  }
  if (ride.rain) {
    const [title, sub] = rainText(ride.rain);
    hints.push(`<div class="hint rain">${icon("drop", 22, "var(--rain)")}<div><strong>${title}</strong><span>${sub}</span></div></div>`);
  }
  if (ride.wind) {
    const [title, sub] = windText(ride.wind);
    const bars = [1, 2, 3].map((i) => `<i class="${i <= ride.windLevel ? "on" : ""}" style="height:${5 + i * 4}px"></i>`).join("");
    hints.push(`<div class="hint wind"><span class="wind-bars" aria-hidden="true">${bars}</span><div><strong>${title}</strong><span>${sub}</span></div></div>`);
  }
  if (!hints.length) {
    hints.push(`<div class="calm">${icon("check", 18, "#9FDB6B", 2)}<span>${t("calm", clock(ride.end), ride.windLevel > 1)}</span></div>`);
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
    details = `<div class="row-title" style="color:var(--rain)">${t("rainRow")}</div><div class="timeline-row">${rainRow}</div>
      <div class="row-title" style="color:var(--wind)">${t("gustRow")}</div><div class="timeline-row">${gustRow}</div>`;
  }

  document.getElementById("ride-dynamic").innerHTML = `<div class="hints">${hints.join("")}</div>
    <div class="timeline"><div class="timeline-row">${tempRow}</div>${details}</div>`;

  renderOutfit(check);
}

function renderOutfit(check) {
  const outfit = check.outfit;
  const ride = check.ride;
  const warmth = t("warmth");

  const tiles = outfit.zones.map((zone) => {
    const layers = zone.layers;
    const canOpen = layers.length > 0;
    const open = canOpen && state.openZone === zone.key;
    const outer = layers[layers.length - 1];
    const strip = (layers.length ? layers : [null]).map((l) => `<i class="${l ? `w${l.warmth}` : ""}"></i>`).join("");

    let meta = "";
    if (layers.length > 1) {
      const n = layers.length - 1;
      meta = `<span class="more-badge">+${n}</span><span>${t("layersBelow", n)}</span>`;
    } else if (layers.length === 1) {
      meta = `<span class="muted">${outer.missing ? t("notOwned") : warmth[outer.warmth]}</span>`;
    }

    const inner = `<span class="tile-zone">${icon(zone.key, 22, "#C3C7CD")}${t("zones")[zone.key]}</span>
      <span class="tile-item ${layers.length ? "" : "empty"}">${outer ? escapeHtml(itemName(outer.name)) : t("nothingExtra")}</span>
      <span class="tile-meta">${meta}</span>
      <span class="strip">${strip}</span>`;

    return canOpen
      ? `<button class="tile" data-action="toggle-zone" data-zone="${zone.key}" aria-expanded="${open}">${inner}</button>`
      : `<div class="tile">${inner}</div>`;
  });

  // Regen-Kachel
  const gear = outfit.rainGear;
  let gearMeta = t("dryRide");
  if (gear) {
    if (gear.missing) gearMeta = t("notOwned");
    else gearMeta = ride.rainSoonestHour !== null ? t("rainAt", t("atHour", ride.rainSoonestHour)) : t("takeAlong");
  }
  tiles.push(`<div class="tile ${gear ? "rain-on" : ""}">
    <span class="tile-zone">${icon("drop", 22, gear ? "var(--rain)" : "#6E747D")}${t("zones").rain}</span>
    <span class="tile-item ${gear ? "" : "empty"}">${gear ? escapeHtml(itemName(gear.name)) : t("notNeeded")}</span>
    <span class="tile-meta"><span class="muted">${gearMeta}</span></span>
    <span class="strip"><i class="${gear ? "w0" : ""}"></i></span>
  </div>`);

  // Aufgeklappte Zone - auch wenn sie nur ein Teil hat
  let detail = "";
  const openZone = outfit.zones.find((z) => z.key === state.openZone && z.layers.length > 0);
  if (openZone) {
    const rows = [...openZone.layers].reverse().map((l) => `<div class="layer">
      <span class="swatch w${l.warmth}"></span>
      <span class="name">${escapeHtml(itemName(l.name))}${l.missing ? ` <small class="muted">(${t("notOwned")})</small>` : ""}</span>
      <span class="word w${l.warmth}">${warmth[l.warmth]}</span></div>`).join("");
    const heading = openZone.layers.length > 1 ? `${t("zones")[openZone.key]} · ${t("outsideIn")}` : t("zones")[openZone.key];
    detail = `<div class="layer-detail"><div class="label-small">${heading}</div>${rows}</div>`;
  }

  const tip = outfit.tip === "colder" ? t("tipColder") : (outfit.tip === "warmer" ? t("tipWarmer") : null);

  document.getElementById("outfit").innerHTML = `
    <div class="outfit-head">
      <div class="eyebrow">${icon("torso", 16, "currentColor", 2)}${t("dress")}</div>
      <div class="hint-text">${t("forColdest", deg(ride.coldest))}</div>
    </div>
    <div class="tiles">${tiles.join("")}</div>
    ${detail}
    <div class="legend">
      <span><i class="w1"></i>${warmth[1]}</span><span><i class="w2"></i>${warmth[2]}</span><span><i class="w3"></i>${warmth[3]}</span>
    </div>
    ${tip ? `<div class="tip">${tip}</div>` : ""}`;
}

// ---------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------

const LEVEL_COLORS = ["#8FB8FF", "#62C1F5", "#9FDB6B", "#FFC94A", "#FF7A45"];

const WARDROBE_GROUPS = [
  ...ZONES.map((zone) => ({
    key: zone.key,
    items: Object.entries(CATALOG).filter(([, info]) => info[0] === zone.key).map(([name, info]) => ({ name, warmth: info[2] })),
  })),
  { key: "rain", items: RAIN_GEAR_ALL.map((name) => ({ name, warmth: 0 })) },
];

function openSettings() {
  state.draft = JSON.parse(JSON.stringify(state.settings));
  state.search = { query: "", results: [], busy: false, error: null };
  state.view = "settings";
  render();
  window.scrollTo(0, 0);
}

function closeSettings() {
  setLanguage(state.settings.language); // ungespeicherte Sprachwahl verwerfen
  state.view = "home";
  state.draft = null;
  render();
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
  const chips = items.map((it, i) => `${i ? '<span class="muted" aria-hidden="true">+</span>' : ""}<span class="chip-static"><span class="dot w${it.warmth}"></span>${escapeHtml(itemName(it.name))}</span>`).join("");

  const stuck = (draft.sensitivity > 3 && level === 1 && baseLevel === 1) || (draft.sensitivity < 3 && level === 5 && baseLevel === 5);

  return `<div class="example">
    <span class="hint-text">${t("example", deg(riding))}</span>
    <div class="chips">${chips}</div>
    ${stuck ? `<span class="hint-text">${t("noDifference")}</span>` : ""}</div>`;
}

function renderSettings() {
  const draft = state.draft;
  const onboarding = !state.settings.onboarded;
  const levelColor = LEVEL_COLORS[draft.sensitivity - 1];
  const [levelTitle, levelText] = t("levels")[draft.sensitivity - 1];
  const wardrobe = new Set(draft.wardrobe);
  const warmth = t("warmth");

  const languages = LANGUAGES.map((lang) => `<button class="segment" data-action="set-language" data-language="${lang.code}" aria-pressed="${draft.language === lang.code}">${lang.name}</button>`).join("");

  const levels = [1, 2, 3, 4, 5].map((n) => {
    const on = n === draft.sensitivity;
    const color = LEVEL_COLORS[n - 1];
    return `<button class="level" data-action="set-level" data-level="${n}" aria-pressed="${on}" aria-label="${t("level", n, t("levels")[n - 1][0])}"
      style="${on ? `background:${color};border-color:${color}` : `color:${color}`}">${n}</button>`;
  }).join("");

  const groups = WARDROBE_GROUPS.map((group) => {
    const count = group.items.filter((it) => wardrobe.has(it.name)).length;
    const chips = group.items.map((it) => `<button class="chip" data-action="toggle-item" data-item="${escapeHtml(it.name)}" aria-pressed="${wardrobe.has(it.name)}">
      <span class="dot w${it.warmth}"></span>${escapeHtml(itemName(it.name))}${wardrobe.has(it.name) ? icon("check", 14, "#F4F1EA", 3) : ""}</button>`).join("");
    const groupIcon = group.key === "rain" ? icon("drop", 20, "var(--rain)") : icon(group.key, 20, "#C3C7CD");
    return `<div class="category">
      <div class="category-head"><span class="category-name">${groupIcon}${t("zones")[group.key]}</span><span class="hint-text">${t("countOf", count, group.items.length)}</span></div>
      <div class="chips">${chips}</div></div>`;
  }).join("");

  const search = state.search;
  const manualBlock = draft.useGps ? "" : `
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="hint-text">${t("current")}: <strong style="color:var(--text)">${escapeHtml(draft.manualPlace.name)}</strong>${draft.manualPlace.region ? ` · ${escapeHtml(draft.manualPlace.region)}` : ""}</div>
      <form class="search" data-action="search">
        <label for="place-search" class="visually-hidden">${t("searchPlace")}</label>
        <input id="place-search" class="text-input" type="search" placeholder="${t("searchPlaceholder")}" value="${escapeHtml(search.query)}" autocomplete="off">
        <button class="secondary-button" type="submit">${search.busy ? "…" : t("search")}</button>
      </form>
      ${search.error ? `<div class="hint-text">${escapeHtml(search.error)}</div>` : ""}
      <div class="results">${search.results.map((place, i) => `<button class="result" data-action="pick-place" data-index="${i}" aria-pressed="${place.latitude === draft.manualPlace.latitude && place.longitude === draft.manualPlace.longitude}">
        <span>${escapeHtml(place.name)}</span><small>${escapeHtml(place.region)}</small></button>`).join("")}</div>
    </div>`;

  app.innerHTML = `<div class="app">
    <header class="page-head">
      ${onboarding ? "" : `<button class="icon-button" data-action="close-settings" aria-label="${t("back")}">${icon("chevronLeft", 20, "currentColor", 2.2)}</button>`}
      <div><div class="page-title">${onboarding ? t("welcome") : t("settings")}</div>
      <div class="hint-text">${onboarding ? t("setupHint") : t("settingsHint")}</div></div>
    </header>

    <section class="card">
      <div class="eyebrow">${icon("globe", 16, "currentColor", 2)}${t("language")}</div>
      <div class="segments">${languages}</div>
    </section>

    <section class="card">
      <div class="eyebrow">${icon("pin", 16, "currentColor", 2)}${t("location")}</div>
      <div class="switch-row">
        <div><div class="question">${t("gps")}</div>
        <div class="hint-text">${draft.useGps ? t("gpsOn") : t("gpsOff")}</div></div>
        <button class="switch" data-action="toggle-gps" aria-pressed="${draft.useGps}" aria-label="${t("gps")}"></button>
      </div>
      ${manualBlock}
    </section>

    <section class="card">
      <div class="eyebrow">${icon("thermometer", 16, "currentColor", 2)}${t("coldFeeling")}</div>
      <div class="question">${t("coldQuestion")}</div>
      <div class="levels">${levels}</div>
      <div class="level-ends"><span>${t("freezesFast")}</span><span>${t("neverFreezes")}</span></div>
      <div class="level-info" style="border-color:${levelColor}">
        <div class="level-title" style="color:${levelColor}">${levelTitle}</div>
        <div class="level-text">${levelText}</div>
        ${renderExample(draft)}
      </div>
    </section>

    <section class="card">
      <div class="outfit-head"><div class="eyebrow">${icon("torso", 16, "currentColor", 2)}${t("wardrobe")}</div><div class="hint-text">${t("selected", draft.wardrobe.length)}</div></div>
      <div class="question">${t("whatDoYouOwn")}</div>
      <div class="hint-text" style="margin-top:-6px">${t("wardrobeHint")}</div>
      ${groups}
      <div class="legend" style="padding-top:10px;border-top:1px solid var(--card-border)">
        <span><i class="w1"></i>${warmth[1]}</span><span><i class="w2"></i>${warmth[2]}</span><span><i class="w3"></i>${warmth[3]}</span><span><i class="w0"></i>${warmth[0]}</span>
      </div>
    </section>

    <button class="primary-button" data-action="save-settings">${onboarding ? t("letsGo") : t("save")}</button>
  </div>`;
}

async function runSearch(query) {
  state.search = { query, results: [], busy: true, error: null };
  render();
  try {
    const results = await searchPlaces(query, state.draft.language);
    state.search = { query, results, busy: false, error: results.length ? null : t("noPlace") };
  } catch {
    state.search = { query, results: [], busy: false, error: t("searchFailed") };
  }
  render();
}

function saveAndClose() {
  const before = state.settings;
  const after = { ...state.draft, onboarded: true };
  const locationChanged = before.useGps !== after.useGps
    || before.manualPlace.latitude !== after.manualPlace.latitude
    || before.manualPlace.longitude !== after.manualPlace.longitude;
  const languageChanged = before.language !== after.language;

  state.settings = after;
  saveSettings(after);
  setLanguage(after.language);
  state.view = "home";
  state.draft = null;

  // Neue Sprache beim GPS-Ortsnamen? Dann auch neu laden.
  if (locationChanged || !state.weather || (languageChanged && after.useGps)) loadWeather();
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
  if (action === "close-settings") closeSettings();
  if (action === "retry") loadWeather();
  if (action === "toggle-details") { state.showDetails = !state.showDetails; renderHome(); }
  if (action === "toggle-zone") {
    const zone = target.dataset.zone;
    state.openZone = state.openZone === zone ? null : zone;
    updateRide();
  }
  if (action === "set-language") {
    state.draft.language = target.dataset.language;
    setLanguage(state.draft.language); // Vorschau sofort in der neuen Sprache
    renderSettings();
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
    state.draft.manualPlace = state.search.results[Number(target.dataset.index)];
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
  // Ersteinrichtung: Einstellungen zeigen. Nach GPS fragen wir erst, wenn man auf "Los geht's" tippt.
  openSettings();
  if (!state.settings.useGps) loadWeather().then(() => { if (state.view === "settings") renderSettings(); });
}
