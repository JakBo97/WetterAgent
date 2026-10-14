// =====================================================================
// 2. BEWERTUNG
// Reine Logik: bekommt Daten, gibt Ergebnisse zurück.
// Kein fetch, kein HTML. 1:1 übertragen aus main.py.
// =====================================================================

// Interne Annahmen
const AVERAGE_RIDING_SPEED_KMH = 60;   // bleibt, keine Nutzereinstellung
export const TIMELINE_HOURS = 8;

// Fahrtemperatur (siehe getRidingBreakdown)
const WIND_HEIGHT_FACTOR = 0.67;       // Wind in 10 m Höhe -> Wind auf Fahrerhöhe
const SKIN_TEMP = 33;                  // ab hier kühlt Fahrtwind nicht mehr
const WINDCHILL_MAX_TEMP = 10;         // Gültigkeitsgrenze der Windchill-Formel
const HEAT_WIND_MAX_BONUS = 2;         // max. Erwärmung durch heißen Fahrtwind
const SUN_ABSORB_FACTOR = 0.25;        // Anteil der Sonneneinstrahlung, der beim Fahrer ankommt
const SUN_MAX_BONUS = 4;               // Obergrenze Sonne in °C
const RAIN_LIGHT_MM = 0.1;             // ab leichtem Regen (mm/h) ...
const RAIN_LIGHT_PENALTY = 2;          // ... 2 °C kälter
const RAIN_MODERATE_MM = 2;            // ab mäßigem Regen (mm/h) ...
const RAIN_MODERATE_PENALTY = 3;       // ... 3 °C kälter

// Schwellenwerte
const RAIN_PROB_HIGH = 60;
const RAIN_PROB_MODERATE = 30;
export const GUSTS_STRONG = 35;
const GUSTS_MODERATE = 20;
const ICE_GROUND_TEMP = 1.0;
const ICE_DEW_POINT_GAP = 1.5;
const ICE_WET_HOURS = 3;
const TREND_CHANGE = 3;

// Einordnung der Fahrtemperatur fürs Motorradfahren: unter diesem Wert -> Bezeichnung
export const FEEL_BANDS = [
  { limit: 8, label: "Kalt", color: "#8FB8FF" },
  { limit: 16, label: "Kühl", color: "#5FD4C0" },
  { limit: 26, label: "Angenehm", color: "#9FDB6B" },
  { limit: Infinity, label: "Heiß", color: "#FF7A45" },
];

// Kleidungstemperatur = kältester Moment der Fahrt + SENSITIVITY_STEP × (Kälteempfinden − 3)
// Stufe 1 (friert schnell) rechnet 8 °C kälter, Stufe 5 (friert nie) 8 °C wärmer.
const SENSITIVITY_STEP = 4;

// Oberkörper: Punkte und Bedarf
const TORSO_POINTS = { jacket: 5, layerLight: 2, layerWarm: 3, heatedVest: 6 };
const TORSO_MAX_LAYERS = 2;            // unter der Jacke höchstens zwei Schichten (Heizweste zählt mit)
// Bedarf ab dieser Kleidungstemperatur (untere Grenze inklusive), von warm nach kalt
const TORSO_NEEDS = [[19, 5], [15, 7], [10, 8], [5, 10], [0, 11], [-Infinity, 14]];
const GUSTS_EXTRA_NEED = 1;            // starke Böen: Oberkörper braucht 1 Punkt mehr
const NO_PROTECTION_TOP_FROM = 19;     // ohne "Motorradjacke immer": ab hier nur T-Shirt

// Andere Zonen: Schwellen nach Kleidungstemperatur
const JEANS_FROM = 17;                 // ab hier Motorradjeans (wenn vorhanden)
const NO_PROTECTION_BOTTOM_FROM = 17;  // ohne "Motorradhose immer": ab hier normale Hose
const THERMO_PANTS_BELOW = 10;         // darunter zusätzlich Thermohose
const SUMMER_GLOVES_FROM = 10;         // ab hier Sommer-, darunter Winterhandschuhe
const SNEAKERS_FROM = 19;              // ab hier Motorrad-Sneaker (wenn vorhanden)
const THERMO_SOCKS_BELOW = 5;          // darunter zusätzlich Thermosocken
const NECK_SCARF_BELOW = 12;           // darunter zusätzlich Halstuch ...
const NECK_SCARF_BELOW_GUSTS = 16;     // ... bei starken Böen schon darunter

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

// Alle Teile im Kleiderschrank: Name -> [Zone, Rolle, Wärme]
// Rolle: "base" = unten drunter, "mid" = Zwischenschicht/Zusatz, "outer" = außen
// Wärme (1-3) ist für Farbe und Wort in der Anzeige: 1 leicht, 2 warm, 3 winterfest.
// Langarm-Shirt, Pullover usw. stehen nicht im Kleiderschrank: dafür gibt es am Oberkörper
// die allgemeinen Schichten "leicht" und "warm", die jeder hat (LAYER_TYPES).
export const CATALOG = {
  "Halstuch": ["head", "mid", 1],
  "Sturmhaube": ["head", "outer", 2],
  "Textiljacke": ["torso", "outer", 2],
  "Lederjacke": ["torso", "outer", 2],
  "Heizweste": ["torso", "mid", 3],
  "Sommerhandschuhe": ["hands", "outer", 1],
  "Winterhandschuhe": ["hands", "outer", 3],
  "Thermohose": ["legs", "base", 2],
  "Motorradjeans": ["legs", "outer", 1],
  "Textilhose": ["legs", "outer", 2],
  "Lederhose": ["legs", "outer", 2],
  "Thermosocken": ["boots", "base", 2],
  "Motorrad-Sneaker": ["boots", "outer", 1],
  "Motorradstiefel": ["boots", "outer", 2],
};

// Allgemeine Schichten am Oberkörper (kein Kleiderschrank-Teil): Typ -> [Rolle, Wärme]
export const LAYER_TYPES = {
  layerLight: ["base", 1],
  layerWarm: ["mid", 2],
};

// Kombi: Jacke und Hose aus demselben Material. Motorradjeans passt zu beiden.
const KOMBI = {
  textil: { jacket: "Textiljacke", pants: "Textilhose" },
  leder: { jacket: "Lederjacke", pants: "Lederhose" },
};

export const RAIN_GEAR = "Regenkombi";

// ---------------------------------------------------------------------
// Temperatur
// ---------------------------------------------------------------------

// Windchill-Formel (JAG/TI) der Wetterdienste, offiziell nur bis 10 °C definiert
function windchill(temperature, speedKmh) {
  const v = speedKmh ** 0.16;
  return 13.12 + 0.6215 * temperature - 11.37 * v + 0.3965 * temperature * v;
}

// Gefühlte Temperatur auf dem Motorrad, in ihre Einzelteile zerlegt.
// Bekommt ein Wetter-Objekt (jetzt oder eine Stunde) mit temperature, windSpeed, radiation, precipitation.
// Ergebnis: { air, wind, sun, rain, riding } - wind, sun, rain als Veränderung in °C (z. B. wind: -2.8)
export function getRidingBreakdown({ temperature, windSpeed, radiation, precipitation }) {
  // 1. Effektiver Fahrtwind: Fahrgeschwindigkeit plus Wetterwind auf Fahrerhöhe
  const weatherWind = WIND_HEIGHT_FACTOR * (windSpeed || 0);
  const speed = Math.sqrt(AVERAGE_RIDING_SPEED_KMH ** 2 + weatherWind ** 2);

  // 2. Fahrtwind-Effekt: bis 10 °C Windchill, darüber schwächer bis zur Hauttemperatur,
  //    über 33 °C wärmt der heiße Fahrtwind leicht (höchstens HEAT_WIND_MAX_BONUS)
  let cooling;
  if (temperature <= WINDCHILL_MAX_TEMP) {
    cooling = Math.max(0, temperature - windchill(temperature, speed));
  } else {
    const coolingAtLimit = WINDCHILL_MAX_TEMP - windchill(WINDCHILL_MAX_TEMP, speed);
    cooling = coolingAtLimit * (SKIN_TEMP - temperature) / (SKIN_TEMP - WINDCHILL_MAX_TEMP);
    cooling = Math.max(cooling, -HEAT_WIND_MAX_BONUS);
  }
  const wind = -cooling;

  // 3. Sonne: wärmt, beim Fahren aber weniger, weil der Fahrtwind die Wärme wegträgt
  let sun = 0;
  if (radiation) {
    const speedMs = speed / 3.6;
    const absorbed = SUN_ABSORB_FACTOR * radiation;
    sun = Math.min(SUN_MAX_BONUS, 0.70 * absorbed / (speedMs + 10));
  }

  // 4. Regen: Nässe kühlt zusätzlich
  let rain = 0;
  if (precipitation >= RAIN_MODERATE_MM) rain = -RAIN_MODERATE_PENALTY;
  else if (precipitation >= RAIN_LIGHT_MM) rain = -RAIN_LIGHT_PENALTY;

  // 5. Alles zusammen, auf eine Nachkommastelle
  const riding = Math.round((temperature + wind + sun + rain) * 10) / 10;
  return { air: temperature, wind, sun, rain, riding };
}

export function getRidingTemperature(weather) {
  return getRidingBreakdown(weather).riding;
}

export function getFeelBand(ridingTemperature) {
  return FEEL_BANDS.find((band) => ridingTemperature < band.limit);
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
  const breakdown = getRidingBreakdown(current);
  const riding = breakdown.riding;
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
    breakdown,              // Einzelteile für das Info-Fenster
    airTemperature: current.temperature,
    band: getFeelBand(riding),
    ice,
    iceUntil,
  };
}

// ---------------------------------------------------------------------
// Block 2: DEINE FAHRT
// ---------------------------------------------------------------------

// Wetter zu einem beliebigen Zeitpunkt (z. B. "in 1,5 Stunden"):
// Temperatur und Wind zwischen den Stundenwerten gleichmäßig verteilt, Regen und Sonne aus der
// Stunde, in die der Zeitpunkt fällt (Open-Meteo gibt sie für die Stunde davor an).
export function weatherAt(current, hours, now, time) {
  if (time <= now) return current;
  const points = [{ ...current, time: now }, ...hours.filter((hour) => hour.time > now)];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (time <= b.time) {
      const share = (time - a.time) / (b.time - a.time);
      const mix = (key) => (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * share;
      return { ...b, time, temperature: mix("temperature"), windSpeed: mix("windSpeed"), windGusts: mix("windGusts") };
    }
  }
  return points[points.length - 1];
}

// Ein Zeitpunkt für die große Anzeige oben: live (jetzt) oder später
function analyzeMoment(weather, time, live) {
  const breakdown = getRidingBreakdown(weather);
  return {
    time,
    live,
    ridingTemperature: breakdown.riding,
    breakdown,
    airTemperature: weather.temperature,
    precipitation: weather.precipitation,
    band: getFeelBand(breakdown.riding),
  };
}

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
        ridingTemperature: getRidingTemperature(hour),
        rainProbability: hour.rainProbability,
        gusts: hour.windGusts,
        ice: isIcy(hours, i),
        inRide: hour.time <= rideEnd,
      });
    }
  });

  const rideList = timeline.filter((point) => point.inRide);

  // Ende der Fahrt (auch zwischen zwei vollen Stunden) - das zeigt die große Zahl oben
  const endWeather = weatherAt(current, hours, now, rideEnd);
  const endMoment = analyzeMoment(endWeather, rideEnd, rideHours === 0);

  const temperatures = [getRidingTemperature(current),
    ...rideList.map((p) => p.ridingTemperature), endMoment.ridingTemperature];
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
    endMoment,
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

export function clothingTemperature(coldest, sensitivity) {
  return coldest + SENSITIVITY_STEP * (sensitivity - 3);
}

// Ein Kleiderschrank-Teil als Schicht: { type: "item", name, role, warmth, missing }
function item(name, wardrobe) {
  const [, role, warmth] = CATALOG[name];
  return { type: "item", name, role, warmth, missing: !wardrobe.has(name) };
}

// Allgemeine Schicht am Oberkörper: { type: "layerLight" | "layerWarm", role, warmth }
function layer(type) {
  const [role, warmth] = LAYER_TYPES[type];
  return { type, role, warmth };
}

// Erstes vorhandenes Teil aus der Liste - sonst das erste, als "nicht im Kleiderschrank"
function firstOwned(names, wardrobe) {
  return item(names.find((name) => wardrobe.has(name)) || names[0], wardrobe);
}

// Welches Material (Textil/Leder) gilt für Jacke und Hose?
// Ergebnis: { material, rainSwitch } - rainSwitch: wegen Regen von Leder auf Textil gewechselt
export function chooseKombi(wardrobe, preferredKombi, rainExpected) {
  const hasTextil = wardrobe.has(KOMBI.textil.jacket);
  const hasLeder = wardrobe.has(KOMBI.leder.jacket);
  if (hasTextil && hasLeder) {
    if (rainExpected && preferredKombi === "leder") return { material: "textil", rainSwitch: true };
    return { material: preferredKombi, rainSwitch: false };
  }
  if (hasTextil) return { material: "textil", rainSwitch: false };
  if (hasLeder) return { material: "leder", rainSwitch: false };
  // Keine Jacke: Material nach den vorhandenen Hosen
  const hasTextilPants = wardrobe.has(KOMBI.textil.pants);
  const hasLederPants = wardrobe.has(KOMBI.leder.pants);
  if (hasTextilPants && hasLederPants) return { material: rainExpected ? "textil" : preferredKombi, rainSwitch: false };
  if (hasLederPants) return { material: "leder", rainSwitch: false };
  if (hasTextilPants) return { material: "textil", rainSwitch: false };
  return { material: preferredKombi, rainSwitch: false };
}

function torsoNeed(clothingTemp, strongGusts) {
  const [, need] = TORSO_NEEDS.find(([from]) => clothingTemp >= from);
  return need + (strongGusts ? GUSTS_EXTRA_NEED : 0);
}

// Alle erlaubten Schicht-Kombinationen unter der Jacke (höchstens TORSO_MAX_LAYERS):
// leichte Schicht höchstens einmal, warme bis zu zweimal, Heizweste nur wenn vorhanden.
function torsoLayerCombos(hasHeatedVest) {
  const options = ["layerLight", "layerWarm", "layerWarm"];
  if (hasHeatedVest) options.push("heatedVest");
  const combos = [[]];
  for (let i = 0; i < options.length; i++) {
    combos.push([options[i]]);
    for (let j = i + 1; j < options.length; j++) combos.push([options[i], options[j]]);
  }
  // doppelte (z. B. die zwei "layerWarm" einzeln) entfernen
  const seen = new Set();
  return combos.filter((combo) => {
    const key = combo.join("+");
    if (seen.has(key)) return false;
    seen.add(key);
    return combo.length <= TORSO_MAX_LAYERS;
  });
}

// Oberkörper: Jacke + Schichten nach Punkten.
// Ergebnis: { layers (innen -> außen), hints, need, points }
export function recommendTorso(clothingTemp, wardrobe, { strongGusts = false, protectionTop = true, kombi }) {
  const hints = [];
  if (kombi.rainSwitch) hints.push("kombiRainSwitch");

  // Ohne "Motorradjacke immer" und warm genug: nur T-Shirt
  if (!protectionTop && clothingTemp >= NO_PROTECTION_TOP_FROM) {
    return { layers: [], hints: [...hints, "noProtectionTop"], need: 0, points: 0 };
  }

  const jacketName = KOMBI[kombi.material].jacket;
  const hasJacket = wardrobe.has(jacketName);
  if (!hasJacket) hints.push("noJacket");
  const jacketPoints = hasJacket ? TORSO_POINTS.jacket : 0;
  const hasHeatedVest = wardrobe.has("Heizweste");
  const need = torsoNeed(clothingTemp, strongGusts);

  // Kleinste Summe, die den Bedarf erreicht; bei Gleichstand weniger Teile.
  // Reicht keine: die wärmste (bei Gleichstand weniger Teile).
  let best = null;
  for (const combo of torsoLayerCombos(hasHeatedVest)) {
    const points = jacketPoints + combo.reduce((sum, type) => sum + TORSO_POINTS[type], 0);
    const candidate = { combo, points, enough: points >= need };
    if (!best) { best = candidate; continue; }
    let better;
    if (candidate.enough !== best.enough) better = candidate.enough;
    else if (candidate.points !== best.points) better = candidate.enough ? candidate.points < best.points : candidate.points > best.points;
    else better = candidate.combo.length < best.combo.length;
    if (better) best = candidate;
  }
  if (!best.enough) hints.push(hasHeatedVest ? "maxWarmth" : "heatedVestWouldHelp");

  // Reihenfolge von innen nach außen: leichte Schicht, warme Schicht(en), Heizweste, Jacke
  const order = ["layerLight", "layerWarm", "heatedVest"];
  const layers = [...best.combo].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((type) => (type === "heatedVest" ? item("Heizweste", wardrobe) : layer(type)));
  if (hasJacket) layers.push(item(jacketName, wardrobe));
  return { layers, hints, need, points: best.points };
}

function recommendLegs(clothingTemp, wardrobe, { protectionBottom = true, kombi }) {
  if (!protectionBottom && clothingTemp >= NO_PROTECTION_BOTTOM_FROM) {
    return { layers: [], hints: ["noProtectionBottom"] }; // normale Hose
  }
  const layers = [];
  if (clothingTemp < THERMO_PANTS_BELOW && wardrobe.has("Thermohose")) layers.push(item("Thermohose", wardrobe));

  let pants;
  if (clothingTemp >= JEANS_FROM && wardrobe.has("Motorradjeans")) {
    pants = item("Motorradjeans", wardrobe);
  } else {
    // Kombi-Hose zur Jacke, sonst die andere Kombi-Hose, sonst Jeans (lieber eine Hose als keine)
    const matching = KOMBI[kombi.material].pants;
    const other = KOMBI[kombi.material === "textil" ? "leder" : "textil"].pants;
    pants = firstOwned([matching, other, "Motorradjeans"], wardrobe);
  }
  layers.push(pants);
  return { layers, hints: [] };
}

function recommendHands(clothingTemp, wardrobe) {
  const names = clothingTemp >= SUMMER_GLOVES_FROM
    ? ["Sommerhandschuhe", "Winterhandschuhe"] : ["Winterhandschuhe", "Sommerhandschuhe"];
  return { layers: [firstOwned(names, wardrobe)], hints: [] };
}

function recommendBoots(clothingTemp, wardrobe) {
  const layers = [];
  if (clothingTemp < THERMO_SOCKS_BELOW && wardrobe.has("Thermosocken")) layers.push(item("Thermosocken", wardrobe));
  const names = clothingTemp >= SNEAKERS_FROM
    ? ["Motorrad-Sneaker", "Motorradstiefel"] : ["Motorradstiefel", "Motorrad-Sneaker"];
  layers.push(firstOwned(names, wardrobe));
  return { layers, hints: [] };
}

function recommendHead(clothingTemp, wardrobe, { strongGusts = false }) {
  const layers = [];
  const scarfBelow = strongGusts ? NECK_SCARF_BELOW_GUSTS : NECK_SCARF_BELOW;
  if (clothingTemp < scarfBelow && wardrobe.has("Halstuch")) layers.push(item("Halstuch", wardrobe));
  if (wardrobe.has("Sturmhaube")) layers.push(item("Sturmhaube", wardrobe));
  return { layers, hints: [] };
}

// Die ganze Empfehlung. options: { sensitivity, wardrobe (Set), rainExpected, strongGusts, change,
// preferredKombi ("textil" | "leder"), protectionTop, protectionBottom }
export function recommendOutfit(coldest, options) {
  const { sensitivity, wardrobe, rainExpected = false, strongGusts = false, change = 0,
    preferredKombi = "textil", protectionTop = true, protectionBottom = true } = options;
  const temp = clothingTemperature(coldest, sensitivity);
  const kombi = chooseKombi(wardrobe, preferredKombi, rainExpected);

  const results = {
    head: recommendHead(temp, wardrobe, { strongGusts }),
    torso: recommendTorso(temp, wardrobe, { strongGusts, protectionTop, kombi }),
    hands: recommendHands(temp, wardrobe),
    legs: recommendLegs(temp, wardrobe, { protectionBottom, kombi }),
    boots: recommendBoots(temp, wardrobe),
  };
  const zones = ZONES.map((zone) => ({ key: zone.key, name: zone.name, ...results[zone.key] }));

  const rainGear = rainExpected ? { name: RAIN_GEAR, missing: !wardrobe.has(RAIN_GEAR) } : null;

  let tip = null;
  if (change <= -TREND_CHANGE) tip = "colder";
  else if (change >= TREND_CHANGE) tip = "warmer";

  return { clothingTemp: temp, kombi, zones, rainGear, tip };
}

// ---------------------------------------------------------------------
// Alles zusammen - der Inhalt der Startseite
// ---------------------------------------------------------------------

// prefs: { sensitivity, wardrobe (Set), preferredKombi, protectionTop, protectionBottom }
export function buildQuickCheck(current, hours, now, rideHours, prefs) {
  const nowBlock = analyzeNow(current, hours, now);
  const ride = analyzeRide(current, hours, now, rideHours);

  // Ist es jetzt schon glatt, steht die Warnung oben - nicht doppelt im Fahrt-Block
  if (nowBlock.ice) ride.iceLater = null;

  // Die große Anzeige oben zeigt den Zeitpunkt, den der Regler einstellt (0 = live)
  const moment = ride.endMoment;

  const outfit = recommendOutfit(ride.coldest, {
    ...prefs, rainExpected: ride.rainExpected, strongGusts: ride.wind !== null, change: ride.change,
  });
  return { now: nowBlock, moment, ride, outfit };
}
