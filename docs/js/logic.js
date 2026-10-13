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
const CLOTHING_LEVELS = [[5, 5], [10, 4], [15, 3], [19, 2]];

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

// Alle Teile, die die App kennt: Name -> [Zone, Rolle, Wärme, Punkte]
// Rolle: "base" = unten drunter, "mid" = Zwischenschicht/Zusatz, "outer" = außen
// Wärme (1-3) ist nur für Farbe und Wort in der Anzeige.
// Punkte (1-10) sind für die Berechnung: Oberkörper zählt am meisten, dann Unterkörper,
// dann Schuhe; Kopf und Hände eher wenig. Eine 10 wäre eine beheizte Winterjacke.
export const CATALOG = {
  "Halstuch": ["head", "mid", 1, 2],      // nur als Zusatz zur Sturmhaube, nie allein
  "Sturmhaube": ["head", "outer", 2, 1],
  "Langarm-Shirt": ["torso", "base", 1, 2],
  "Thermo-Shirt": ["torso", "base", 2, 3],
  "Pullover": ["torso", "mid", 2, 4],
  "Heizweste": ["torso", "mid", 3, 7],
  "Textiljacke": ["torso", "outer", 2, 6],
  "Lederjacke": ["torso", "outer", 2, 5],
  "Sommerhandschuhe": ["hands", "outer", 1, 1],
  "Winterhandschuhe": ["hands", "outer", 3, 4],
  "Thermohose": ["legs", "base", 2, 3],
  "Motorradjeans": ["legs", "outer", 1, 3],
  "Textilhose": ["legs", "outer", 2, 5],
  "Lederhose": ["legs", "outer", 2, 4],
  "Thermosocken": ["boots", "base", 2, 2],
  "Motorrad-Sneaker": ["boots", "outer", 1, 2],
  "Motorradstiefel": ["boots", "outer", 2, 4],
};

// Punktebedarf je Zone und Kleidungsstufe 1-5
// (Stufe 1: ab 19° Fahrtemperatur, 2: 15-19°, 3: 10-15°, 4: 5-10°, 5: unter 5°).
// Gezählt wird nur, was zum Wärmen nötig ist - Schutzkleidung regelt GEAR_ZONES.
const ZONE_NEEDS = {
  head: [0, 1, 3, 3, 3],    // 1 = Sturmhaube, 3 = Sturmhaube + Halstuch
  torso: [0, 7, 8, 9, 13],
  hands: [0, 1, 4, 4, 4],
  legs: [0, 3, 5, 8, 8],
  boots: [2, 4, 4, 6, 6],
};

// Typischer Kleiderschrank für das Beispiel beim Kälteempfinden (ohne Sonderteile)
const REFERENCE_WARDROBE = new Set(Object.keys(CATALOG)
  .filter((name) => !["Heizweste", "Lederjacke", "Lederhose"].includes(name)));

export const RAIN_GEAR = "Regenkombi";

// Schutzkleidung: Zonen, deren Außenteil (Jacke, Hose, Handschuhe) vor allem schützt.
// Fährt jemand nicht immer mit Schutzkleidung, sind sie nur optional, solange die Zone
// keine Wärmepunkte braucht.
export const GEAR_ZONES = ["torso", "legs", "hands"];

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

const itemsOf = (zone, role) => Object.keys(CATALOG)
  .filter((name) => CATALOG[name][0] === zone && CATALOG[name][1] === role);
const pointsOf = (items) => items.reduce((sum, name) => sum + CATALOG[name][3], 0);

// Ist Kombination a besser als b? Erst: reicht es? Reicht es, möglichst wenig Punkte zu viel,
// sonst möglichst viele Punkte. Bei Gleichstand: weniger Teile.
function isBetter(a, b) {
  if (a.enough !== b.enough) return a.enough;
  if (a.points !== b.points) return a.enough ? a.points < b.points : a.points > b.points;
  return a.items.length < b.items.length;
}

// Wählt für eine Zone die Teile, die den Punktebedarf decken (Schichten von innen nach außen).
// Höchstens ein Teil pro Rolle. Unterschichten und Zusätze nie ohne Außenteil.
// Hat man kein Außenteil für die Zone, kommen alle in Frage - als "nicht im Kleiderschrank".
export function selectZone(zone, need, wardrobe) {
  const owned = (role) => itemsOf(zone, role).filter((name) => wardrobe.has(name));
  const outers = owned("outer").length ? owned("outer") : itemsOf(zone, "outer");
  let best = null;
  for (const outer of outers) {
    for (const base of [null, ...owned("base")]) {
      for (const mid of [null, ...owned("mid")]) {
        const items = [base, mid, outer].filter(Boolean);
        const points = pointsOf(items);
        const candidate = { items, points, enough: points >= need };
        if (!best || isBetter(candidate, best)) best = candidate;
      }
    }
  }
  return best;
}

// Ideal-Outfit einer Kleidungsstufe mit dem typischen Kleiderschrank: { head: [...], torso: [...], ... }
// Teile, die nur optional wären (Bedarf 0 am Kopf), zählen nicht.
export function idealOutfit(level) {
  const outfit = {};
  for (const zone of ZONES) {
    const need = ZONE_NEEDS[zone.key][level - 1];
    outfit[zone.key] = need === 0 && zone.key === "head"
      ? [] : selectZone(zone.key, need, REFERENCE_WARDROBE).items;
  }
  return outfit;
}

// Was ändert sich zwischen zwei Kleidungsstufen? Vergleicht die Ideal-Outfits (ohne eigenen Kleiderschrank).
// Ergebnis: nur Zonen mit Änderung, z. B. { zone: "hands", added: ["Winterhandschuhe"], removed: ["Sommerhandschuhe"] }
export function compareOutfits(fromLevel, toLevel) {
  const from = idealOutfit(fromLevel);
  const to = idealOutfit(toLevel);
  return ZONES.map((zone) => {
    const before = from[zone.key];
    const after = to[zone.key];
    return {
      zone: zone.key,
      added: after.filter((item) => !before.includes(item)),
      removed: before.filter((item) => !after.includes(item)),
    };
  }).filter((change) => change.added.length || change.removed.length);
}

export function recommendOutfit(coldest, sensitivity, wardrobe, rainExpected, change, alwaysGear) {
  const level = getClothingLevel(coldest, sensitivity);

  const zones = ZONES.map((zone) => {
    const need = ZONE_NEEDS[zone.key][level - 1];
    const pick = selectZone(zone.key, need, wardrobe);
    let layers = pick.items.map((name) => ({ name, warmth: CATALOG[name][2], missing: !wardrobe.has(name) }));
    let noGear = false;

    if (need === 0 && GEAR_ZONES.includes(zone.key)) {
      // Kein Wärmebedarf: Schutzkleidung empfehlen - oder, wenn nicht gewünscht, nur optional
      if (!alwaysGear) {
        noGear = true;
        layers.forEach((layer) => { layer.optional = true; });
      }
    } else if (need === 0) {
      // Kopf ohne Wärmebedarf: Sturmhaube nur als optionaler Tipp, wenn man eine hat
      layers = layers.filter((layer) => !layer.missing);
      layers.forEach((layer) => { layer.optional = true; });
    }

    // Reicht der Kleiderschrank nicht für den Bedarf? (Kopf ist eher optional, dort kein Hinweis)
    const tooCold = !pick.enough && zone.key !== "head";
    return { key: zone.key, name: zone.name, layers, noGear, tooCold, need, points: pick.points };
  });

  const rainGear = rainExpected ? { name: RAIN_GEAR, missing: !wardrobe.has(RAIN_GEAR) } : null;

  let tip = null;
  if (change <= -TREND_CHANGE) tip = "colder";
  else if (change >= TREND_CHANGE) tip = "warmer";

  return { level, zones, rainGear, tip };
}

// ---------------------------------------------------------------------
// Alles zusammen - der Inhalt der Startseite
// ---------------------------------------------------------------------

export function buildQuickCheck(current, hours, now, rideHours, sensitivity, wardrobe, alwaysGear) {
  const nowBlock = analyzeNow(current, hours, now);
  const ride = analyzeRide(current, hours, now, rideHours);

  // Ist es jetzt schon glatt, steht die Warnung oben - nicht doppelt im Fahrt-Block
  if (nowBlock.ice) ride.iceLater = null;

  const outfit = recommendOutfit(ride.coldest, sensitivity, wardrobe, ride.rainExpected, ride.change, alwaysGear);
  return { now: nowBlock, ride, outfit };
}
