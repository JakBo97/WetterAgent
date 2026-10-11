// =====================================================================
// 2. BEWERTUNG
// Reine Logik: bekommt Daten, gibt Ergebnisse zurück.
// Kein fetch, kein HTML. 1:1 übertragen aus main.py.
// =====================================================================

// Interne Annahmen
const AVERAGE_RIDING_SPEED_KMH = 60;
export const TIMELINE_HOURS = 8;

// Schwellenwerte
const RAIN_PROB_HIGH = 60;
const RAIN_PROB_MODERATE = 30;
export const GUSTS_STRONG = 35;
const GUSTS_MODERATE = 20;
const ICE_GROUND_TEMP = 1.0;
const ICE_DEW_POINT_GAP = 1.5;
const ICE_WET_HOURS = 3;
const TREND_CHANGE = 3;

// Einordnung der Fahrtemperatur: unter diesem Wert -> Bezeichnung
export const FEEL_BANDS = [
  { limit: 5, label: "Sehr kalt", color: "#8FB8FF" },
  { limit: 12, label: "Kalt", color: "#62C1F5" },
  { limit: 18, label: "Kühl", color: "#5FD4C0" },
  { limit: 25, label: "Angenehm", color: "#9FDB6B" },
  { limit: 30, label: "Warm", color: "#FFC94A" },
  { limit: Infinity, label: "Heiß", color: "#FF7A45" },
];

// Kleidungsstufe nach kältestem Moment: unter diesem Wert -> Stufe (sonst 1)
const CLOTHING_LEVELS = [[5, 5], [10, 4], [14, 3], [19, 2]];

// Kälteempfinden verschiebt die Kleidungsstufe
const SENSITIVITY_SHIFT = { 1: 2, 2: 1, 3: 0, 4: -1, 5: -2 };

// ---------------------------------------------------------------------
// Kleidung
// ---------------------------------------------------------------------

export const WARMTH_WORDS = { 1: "leicht", 2: "warm", 3: "winterfest" };

export const ZONES = [
  { key: "head", name: "Kopf" },
  { key: "torso", name: "Oberkörper" },
  { key: "hands", name: "Hände" },
  { key: "legs", name: "Unterkörper" },
  { key: "boots", name: "Schuhe" },
];

// Alle Teile, die die App kennt: Name -> [Zone, Rolle, Wärme]
// Rolle: "base" = unten drunter, "mid" = Zwischenschicht, "outer" = außen
export const CATALOG = {
  "Halstuch": ["head", "outer", 1],
  "Dünne Sturmhaube": ["head", "outer", 1],
  "Winter-Sturmhaube": ["head", "outer", 3],
  "T-Shirt": ["torso", "base", 1],
  "Langarm-Shirt": ["torso", "base", 1],
  "Thermo-Shirt": ["torso", "base", 2],
  "Pullover": ["torso", "mid", 2],
  "Heizweste": ["torso", "mid", 3],
  "Mesh-Jacke": ["torso", "outer", 1],
  "Jacke ohne Futter": ["torso", "outer", 2],
  "Jacke mit Futter": ["torso", "outer", 2],
  "Winterjacke": ["torso", "outer", 3],
  "Sommerhandschuhe": ["hands", "outer", 1],
  "Übergangshandschuhe": ["hands", "outer", 2],
  "Winterhandschuhe": ["hands", "outer", 3],
  "Thermohose": ["legs", "base", 2],
  "Motorradjeans": ["legs", "outer", 1],
  "Motorradhose": ["legs", "outer", 2],
  "Hose mit Futter": ["legs", "outer", 3],
  "Thermosocken": ["boots", "base", 2],
  "Motorrad-Sneaker": ["boots", "outer", 1],
  "Motorradstiefel": ["boots", "outer", 2],
  "Winterstiefel": ["boots", "outer", 3],
};

export const RAIN_GEAR_FULL = "Regenkombi";
export const RAIN_GEAR_PARTS = ["Regenjacke", "Regenhose"];
export const RAIN_GEAR_ALL = ["Regenkombi", "Regenjacke", "Regenhose", "Überziehschuhe"];

// Ideales Outfit je Kleidungsstufe, Schichten von innen nach außen
export const OUTFITS = {
  5: { head: ["Winter-Sturmhaube"], torso: ["Thermo-Shirt", "Pullover", "Winterjacke"],
       hands: ["Winterhandschuhe"], legs: ["Thermohose", "Hose mit Futter"],
       boots: ["Thermosocken", "Winterstiefel"] },
  4: { head: ["Winter-Sturmhaube"], torso: ["Thermo-Shirt", "Jacke mit Futter"],
       hands: ["Winterhandschuhe"], legs: ["Thermohose", "Motorradhose"],
       boots: ["Thermosocken", "Motorradstiefel"] },
  3: { head: ["Dünne Sturmhaube"], torso: ["Langarm-Shirt", "Jacke mit Futter"],
       hands: ["Übergangshandschuhe"], legs: ["Motorradhose"],
       boots: ["Motorradstiefel"] },
  2: { head: ["Halstuch"], torso: ["Langarm-Shirt", "Jacke ohne Futter"],
       hands: ["Übergangshandschuhe"], legs: ["Motorradjeans"],
       boots: ["Motorradstiefel"] },
  1: { head: [], torso: ["T-Shirt", "Mesh-Jacke"],
       hands: ["Sommerhandschuhe"], legs: ["Motorradjeans"],
       boots: ["Motorrad-Sneaker"] },
};

// ---------------------------------------------------------------------
// Temperatur
// ---------------------------------------------------------------------

export function getRidingTemperature(temperature) {
  const v = AVERAGE_RIDING_SPEED_KMH ** 0.16;
  const windChill = 13.12 + 0.6215 * temperature - 11.37 * v + 0.3965 * temperature * v;
  // Fahrtwind kann es nur kälter machen, nicht wärmer
  return Math.round(Math.min(temperature, windChill) * 10) / 10;
}

export function getFeelBand(ridingTemperature) {
  return FEEL_BANDS.find((band) => ridingTemperature < band.limit);
}

export function getClothingLevel(coldest, sensitivity) {
  let level = 1;
  for (const [limit, clothingLevel] of CLOTHING_LEVELS) {
    if (coldest < limit) {
      level = clothingLevel;
      break;
    }
  }
  level += SENSITIVITY_SHIFT[sensitivity];
  return Math.max(1, Math.min(5, level));
}

// ---------------------------------------------------------------------
// Glätte
// ---------------------------------------------------------------------

export function isIcy(hours, index) {
  const hour = hours[index];
  const ground = hour.groundTemp ?? hour.temperature;

  if (ground > ICE_GROUND_TEMP) return false;

  const recent = hours.slice(Math.max(0, index - ICE_WET_HOURS), index + 1);
  const roadWet = recent.some((h) => h.precipitation > 0);

  const frostPossible = hour.dewPoint !== null && hour.dewPoint !== undefined
    && hour.temperature - hour.dewPoint <= ICE_DEW_POINT_GAP;

  return roadWet || frostPossible;
}

function startOfHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function findHourIndex(hours, time) {
  const target = startOfHour(time).getTime();
  return hours.findIndex((hour) => hour.time.getTime() === target);
}

// ---------------------------------------------------------------------
// Block 1: JETZT
// ---------------------------------------------------------------------

export function analyzeNow(current, hours, now) {
  const riding = getRidingTemperature(current.temperature);
  const index = findHourIndex(hours, now);

  // Bis wann bleibt es glatt? (für den Hinweis "bis ca. 9 Uhr")
  let ice = false;
  let iceUntil = null;
  if (index >= 0 && isIcy(hours, index)) {
    ice = true;
    let i = index;
    while (i + 1 < hours.length && isIcy(hours, i + 1)) i++;
    iceUntil = new Date(hours[i].time.getTime() + 60 * 60 * 1000);
  }

  return {
    ridingTemperature: riding,
    airTemperature: current.temperature,
    band: getFeelBand(riding),
    ice,
    iceUntil,
  };
}

// ---------------------------------------------------------------------
// Block 2: DEINE FAHRT
// ---------------------------------------------------------------------

export function analyzeRide(current, hours, now, rideHours) {
  const rideEnd = new Date(now.getTime() + rideHours * 60 * 60 * 1000);
  const firstHour = new Date(startOfHour(now).getTime() + 60 * 60 * 1000);
  const lastHour = new Date(firstHour.getTime() + TIMELINE_HOURS * 60 * 60 * 1000);

  // Verlauf: immer die nächsten 8 Stunden, mit Markierung, was in die Fahrt fällt
  const timeline = [];
  hours.forEach((hour, i) => {
    if (hour.time >= firstHour && hour.time < lastHour) {
      timeline.push({
        time: hour.time,
        ridingTemperature: getRidingTemperature(hour.temperature),
        rainProbability: hour.rainProbability,
        gusts: hour.windGusts,
        ice: isIcy(hours, i),
        inRide: hour.time <= rideEnd,
      });
    }
  });

  const rideList = timeline.filter((point) => point.inRide);

  const temperatures = [getRidingTemperature(current.temperature),
    ...rideList.map((p) => p.ridingTemperature)];
  const change = temperatures[temperatures.length - 1] - temperatures[0];
  const coldest = Math.min(...temperatures);

  // Regen
  const maxRain = Math.max(0, ...rideList.map((p) => p.rainProbability));
  const heavy = rideList.find((p) => p.rainProbability >= RAIN_PROB_HIGH);
  // Die Logik liefert nur Fakten - die Texte (Deutsch/Englisch) baut die Anzeige
  let rain = null;
  if (current.precipitation > 0) {
    rain = { kind: "now" };
  } else if (heavy) {
    rain = { kind: "from", hour: heavy.time.getHours(), probability: heavy.rainProbability };
  } else if (maxRain >= RAIN_PROB_MODERATE) {
    rain = { kind: "possible", probability: maxRain };
  }

  // Wind
  const maxGusts = Math.max(current.windGusts, ...rideList.map((p) => p.gusts));
  let wind = null;
  if (current.windGusts >= GUSTS_STRONG) {
    wind = { kind: "now", maxGusts: Math.round(maxGusts) };
  } else {
    const strong = rideList.find((p) => p.gusts >= GUSTS_STRONG);
    if (strong) {
      wind = { kind: "from", hour: strong.time.getHours(), maxGusts: Math.round(maxGusts) };
    }
  }
  const windLevel = maxGusts >= GUSTS_STRONG ? 3 : (maxGusts >= GUSTS_MODERATE ? 2 : 1);

  // Glätte, die erst während der Fahrt auftritt
  const iceLater = rideList.find((p) => p.ice);

  return {
    rideHours,
    end: rideEnd,
    timeline,
    coldest,
    change,
    rain,
    rainExpected: current.precipitation > 0 || maxRain >= RAIN_PROB_MODERATE,
    rainSoonestHour: heavy ? heavy.time.getHours() : null,
    wind,
    windLevel,
    iceLater: iceLater ? iceLater.time : null,
  };
}

// ---------------------------------------------------------------------
// Block 3: ANZIEHEN
// ---------------------------------------------------------------------

const CATALOG_ORDER = Object.keys(CATALOG);

// Gibt das empfohlene Teil zurück oder den besten Ersatz aus dem Kleiderschrank.
// Ergebnis: { name, missing } - oder null, wenn eine Unterschicht einfach wegfällt.
export function pickFromWardrobe(item, wardrobe) {
  if (wardrobe.has(item)) return { name: item, missing: false };

  const [zone, role, warmth] = CATALOG[item];
  const candidates = [...wardrobe].filter((name) =>
    CATALOG[name] && CATALOG[name][0] === zone && CATALOG[name][1] === role);

  if (candidates.length) {
    // Am nächsten an der gewünschten Wärme, bei Gleichstand lieber wärmer.
    // Danach: ersetzen wir ein leichteres Teil, das leichteste passende, sonst das wärmste.
    const ranking = (name) => {
      const w = CATALOG[name][2];
      const position = CATALOG_ORDER.indexOf(name);
      return [Math.abs(w - warmth), -w, w > warmth ? position : -position];
    };
    candidates.sort((a, b) => {
      const ra = ranking(a);
      const rb = ranking(b);
      for (let i = 0; i < ra.length; i++) {
        if (ra[i] !== rb[i]) return ra[i] - rb[i];
      }
      return 0;
    });
    return { name: candidates[0], missing: false };
  }

  if (role === "outer") return { name: item, missing: true };
  return null;
}

export function recommendOutfit(coldest, sensitivity, wardrobe, rainExpected, change) {
  const level = getClothingLevel(coldest, sensitivity);

  const zones = ZONES.map((zone) => {
    const layers = [];
    for (const item of OUTFITS[level][zone.key]) {
      const picked = pickFromWardrobe(item, wardrobe);
      if (!picked) continue;
      if (layers.some((layer) => layer.name === picked.name)) continue;
      layers.push({ name: picked.name, warmth: CATALOG[picked.name][2], missing: picked.missing });
    }
    return { key: zone.key, name: zone.name, layers };
  });

  let rainGear = null;
  if (rainExpected) {
    if (wardrobe.has(RAIN_GEAR_FULL)) {
      rainGear = { name: RAIN_GEAR_FULL, missing: false };
    } else {
      const parts = RAIN_GEAR_PARTS.filter((part) => wardrobe.has(part));
      rainGear = parts.length
        ? { name: parts.join(" + "), missing: false }
        : { name: RAIN_GEAR_FULL, missing: true };
    }
  }

  let tip = null;
  if (change <= -TREND_CHANGE) tip = "colder";
  else if (change >= TREND_CHANGE) tip = "warmer";

  return { level, zones, rainGear, tip };
}

// ---------------------------------------------------------------------
// Alles zusammen - der Inhalt der Startseite
// ---------------------------------------------------------------------

export function buildQuickCheck(current, hours, now, rideHours, sensitivity, wardrobe) {
  const nowBlock = analyzeNow(current, hours, now);
  const ride = analyzeRide(current, hours, now, rideHours);

  // Ist es jetzt schon glatt, steht die Warnung oben - nicht doppelt im Fahrt-Block
  if (nowBlock.ice) ride.iceLater = null;

  const outfit = recommendOutfit(ride.coldest, sensitivity, wardrobe, ride.rainExpected, ride.change);
  return { now: nowBlock, ride, outfit };
}
