"""
MotoWeather - Quick-Check fürs Motorradfahren

Aufbau in drei Schichten:
1. Datenquelle: holt die Daten von Open-Meteo und übersetzt sie in ein eigenes, einfaches Format
2. Bewertung:   reine Logik - keine API-Aufrufe, keine Ausgabe
3. Anzeige:     Ausgabe im Terminal, aufgebaut wie die drei Blöcke der App

Die Ausgabe folgt dem App-Design:
- JETZT:       gefühlte Temperatur auf dem Motorrad, Einordnung, Glätte
- DEINE FAHRT: Hinweise und Verlauf für die eingestellte Fahrtdauer
- ANZIEHEN:    Kleidung nach Körperzonen, passend zu Kälteempfinden und Kleiderschrank
"""

from datetime import datetime, timedelta

import requests


# =====================================================================
# EINSTELLUNGEN (später: Einstellungsseite der App)
# =====================================================================

LOCATION_NAME = "Freising"
LATITUDE = 48.40
LONGITUDE = 11.74

# Geplante Fahrtdauer ab jetzt, 0.5 bis 8 in halben Stunden - später der Regler
RIDE_HOURS = 2

# Kälteempfinden: 1 = friert schnell, 3 = normal, 5 = friert nie.
# Ändert NICHT die Temperatur, sondern nur, welche Kleidung empfohlen wird.
COLD_SENSITIVITY = 3

# Kleiderschrank: alles, was du besitzt. Empfohlen wird nur daraus.
WARDROBE = {
    "Halstuch", "Winter-Sturmhaube",
    "T-Shirt", "Langarm-Shirt", "Thermo-Shirt", "Pullover",
    "Jacke ohne Futter", "Jacke mit Futter",
    "Sommerhandschuhe", "Winterhandschuhe",
    "Motorradjeans", "Motorradhose", "Thermohose",
    "Motorradstiefel", "Thermosocken",
    "Regenkombi",
}

# Interne Annahmen, keine Nutzereinstellungen
_AVERAGE_RIDING_SPEED_KMH = 60
REQUEST_TIMEOUT_SECONDS = 10
TIMELINE_HOURS = 8  # der Verlauf zeigt immer die nächsten 8 Stunden


# =====================================================================
# SCHWELLENWERTE
# =====================================================================

# Regenwahrscheinlichkeit in %
RAIN_PROB_HIGH = 60
RAIN_PROB_MODERATE = 30

# Böen in km/h
GUSTS_STRONG = 35
GUSTS_MODERATE = 20

# Glätte-Schätzung
ICE_GROUND_TEMP = 1.0       # Boden bei oder unter 1 °C ...
ICE_DEW_POINT_GAP = 1.5     # ... und Luft fast am Taupunkt (Reif möglich)
ICE_WET_HOURS = 3           # ... oder Regen in den letzten 3 Stunden (Straße nass)

# Ab dieser Änderung (°C) während der Fahrt gibt es einen Tipp
TREND_CHANGE = 3

# Einordnung der Fahrtemperatur: (unter diesem Wert, Bezeichnung)
FEEL_BANDS = [
    (5, "Sehr kalt"),
    (12, "Kalt"),
    (18, "Kühl"),
    (25, "Angenehm"),
    (30, "Warm"),
    (None, "Heiß"),
]

# Kleidungsstufe nach kältestem Moment der Fahrt: (unter diesem Wert, Stufe)
CLOTHING_LEVELS = [(5, 5), (10, 4), (14, 3), (19, 2)]  # sonst Stufe 1

# Kälteempfinden verschiebt die Kleidungsstufe
SENSITIVITY_SHIFT = {1: 2, 2: 1, 3: 0, 4: -1, 5: -2}


# =====================================================================
# KLEIDUNG
# =====================================================================

WARMTH_WORDS = {1: "leicht", 2: "warm", 3: "winterfest"}

ZONES = [
    ("head", "Kopf"),
    ("torso", "Oberkörper"),
    ("hands", "Hände"),
    ("legs", "Unterkörper"),
    ("boots", "Schuhe"),
]

# Alle Teile, die die App kennt: Name -> (Zone, Rolle, Wärme)
# Rolle: "base" = unten drunter, "mid" = Zwischenschicht, "outer" = außen
CATALOG = {
    "Halstuch": ("head", "outer", 1),
    "Dünne Sturmhaube": ("head", "outer", 1),
    "Winter-Sturmhaube": ("head", "outer", 3),
    "T-Shirt": ("torso", "base", 1),
    "Langarm-Shirt": ("torso", "base", 1),
    "Thermo-Shirt": ("torso", "base", 2),
    "Pullover": ("torso", "mid", 2),
    "Heizweste": ("torso", "mid", 3),
    "Mesh-Jacke": ("torso", "outer", 1),
    "Jacke ohne Futter": ("torso", "outer", 2),
    "Jacke mit Futter": ("torso", "outer", 2),
    "Winterjacke": ("torso", "outer", 3),
    "Sommerhandschuhe": ("hands", "outer", 1),
    "Übergangshandschuhe": ("hands", "outer", 2),
    "Winterhandschuhe": ("hands", "outer", 3),
    "Thermohose": ("legs", "base", 2),
    "Motorradjeans": ("legs", "outer", 1),
    "Motorradhose": ("legs", "outer", 2),
    "Hose mit Futter": ("legs", "outer", 3),
    "Thermosocken": ("boots", "base", 2),
    "Motorrad-Sneaker": ("boots", "outer", 1),
    "Motorradstiefel": ("boots", "outer", 2),
    "Winterstiefel": ("boots", "outer", 3),
}

RAIN_GEAR_FULL = "Regenkombi"
RAIN_GEAR_PARTS = ["Regenjacke", "Regenhose"]

# Ideales Outfit je Kleidungsstufe, Schichten von innen nach außen
OUTFITS = {
    5: {"head": ["Winter-Sturmhaube"], "torso": ["Thermo-Shirt", "Pullover", "Winterjacke"],
        "hands": ["Winterhandschuhe"], "legs": ["Thermohose", "Hose mit Futter"],
        "boots": ["Thermosocken", "Winterstiefel"]},
    4: {"head": ["Winter-Sturmhaube"], "torso": ["Thermo-Shirt", "Jacke mit Futter"],
        "hands": ["Winterhandschuhe"], "legs": ["Thermohose", "Motorradhose"],
        "boots": ["Thermosocken", "Motorradstiefel"]},
    3: {"head": ["Dünne Sturmhaube"], "torso": ["Langarm-Shirt", "Jacke mit Futter"],
        "hands": ["Übergangshandschuhe"], "legs": ["Motorradhose"],
        "boots": ["Motorradstiefel"]},
    2: {"head": ["Halstuch"], "torso": ["Langarm-Shirt", "Jacke ohne Futter"],
        "hands": ["Übergangshandschuhe"], "legs": ["Motorradjeans"],
        "boots": ["Motorradstiefel"]},
    1: {"head": [], "torso": ["T-Shirt", "Mesh-Jacke"],
        "hands": ["Sommerhandschuhe"], "legs": ["Motorradjeans"],
        "boots": ["Motorrad-Sneaker"]},
}


# =====================================================================
# 1. DATENQUELLE (Open-Meteo)
# Nur dieser Teil kennt die Namen der Open-Meteo-API.
# =====================================================================

# Unser Name -> Name bei Open-Meteo (gibt es aktuell UND stündlich)
VARIABLES = {
    "temperature": "temperature_2m",
    "humidity": "relative_humidity_2m",
    "wind_speed": "wind_speed_10m",
    "wind_gusts": "wind_gusts_10m",
    "precipitation": "precipitation",
    "weather_code": "weather_code",
}

# Nur stündlich
HOURLY_EXTRAS = {
    "rain_probability": "precipitation_probability",
    "ground_temp": "soil_temperature_0cm",
    "dew_point": "dew_point_2m",
}


def fetch_weather(latitude, longitude):
    url = "https://api.open-meteo.com/v1/forecast"

    parameters = {
        "latitude": latitude,
        "longitude": longitude,
        "current": list(VARIABLES.values()),
        "hourly": list(VARIABLES.values()) + list(HOURLY_EXTRAS.values()),
        "timezone": "Europe/Berlin",
        "forecast_days": 2,  # damit 8 Stunden auch abends über Mitternacht reichen
    }

    response = requests.get(url, params=parameters, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()

    return response.json()


def parse_current(raw):
    current = raw["current"]

    data = {}
    for our_name, api_name in VARIABLES.items():
        data[our_name] = current[api_name]

    data["time"] = datetime.fromisoformat(current["time"])

    return data


def parse_hourly(raw):
    hourly = raw["hourly"]
    hours = []

    for i, time_string in enumerate(hourly["time"]):
        hour = {"time": datetime.fromisoformat(time_string)}

        for our_name, api_name in VARIABLES.items():
            hour[our_name] = hourly[api_name][i]

        for our_name, api_name in HOURLY_EXTRAS.items():
            hour[our_name] = hourly[api_name][i]

        # Fehlende Wahrscheinlichkeit als 0 behandeln
        hour["rain_probability"] = hour["rain_probability"] or 0

        hours.append(hour)

    return hours


# =====================================================================
# 2. BEWERTUNG
# Reine Logik: bekommt Daten, gibt Ergebnisse zurück. Kein print, kein API-Call.
# =====================================================================

def get_riding_temperature(temperature):
    """Schätzt, wie kalt es sich auf dem Motorrad anfühlt (Fahrtwind)."""
    v = _AVERAGE_RIDING_SPEED_KMH ** 0.16
    wind_chill = 13.12 + 0.6215 * temperature - 11.37 * v + 0.3965 * temperature * v

    # Fahrtwind kann es nur kälter machen, nicht wärmer
    return round(min(temperature, wind_chill), 1)


def get_feel_label(riding_temperature):
    for limit, label in FEEL_BANDS:
        if limit is None or riding_temperature < limit:
            return label


def get_clothing_level(coldest_riding_temperature, sensitivity):
    level = 1
    for limit, clothing_level in CLOTHING_LEVELS:
        if coldest_riding_temperature < limit:
            level = clothing_level
            break

    level += SENSITIVITY_SHIFT[sensitivity]
    return max(1, min(5, level))


def is_icy(hours, index):
    """Schätzt Glätte für eine Stunde: kalter Boden plus Feuchtigkeit."""
    hour = hours[index]

    ground = hour["ground_temp"]
    if ground is None:
        ground = hour["temperature"]

    if ground > ICE_GROUND_TEMP:
        return False

    recent = hours[max(0, index - ICE_WET_HOURS):index + 1]
    road_wet = any(h["precipitation"] > 0 for h in recent)

    frost_possible = (
        hour["dew_point"] is not None
        and hour["temperature"] - hour["dew_point"] <= ICE_DEW_POINT_GAP
    )

    return road_wet or frost_possible


def find_hour_index(hours, time):
    """Index der Stunde, in die ein Zeitpunkt fällt."""
    target = time.replace(minute=0, second=0, microsecond=0)
    for i, hour in enumerate(hours):
        if hour["time"] == target:
            return i
    return None


def analyze_now(current, hours, now):
    riding = get_riding_temperature(current["temperature"])

    ice = False
    index = find_hour_index(hours, now)
    if index is not None:
        ice = is_icy(hours, index)

    return {
        "riding_temperature": riding,
        "air_temperature": current["temperature"],
        "label": get_feel_label(riding),
        "ice": ice,
    }


def analyze_ride(current, hours, now, ride_hours):
    """Alles, was vom Regler abhängt: Hinweise und Verlauf."""
    ride_end = now + timedelta(hours=ride_hours)
    first_hour = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

    # Verlauf: immer die nächsten 8 Stunden, mit Markierung, was in die Fahrt fällt
    timeline = []
    for i, hour in enumerate(hours):
        if first_hour <= hour["time"] < first_hour + timedelta(hours=TIMELINE_HOURS):
            timeline.append({
                "time": hour["time"],
                "riding_temperature": get_riding_temperature(hour["temperature"]),
                "rain_probability": hour["rain_probability"],
                "gusts": hour["wind_gusts"],
                "ice": is_icy(hours, i),
                "in_ride": hour["time"] <= ride_end,
            })

    ride_hours_list = [point for point in timeline if point["in_ride"]]

    # Temperaturen der Fahrt: jetzt + alle Stunden bis Fahrtende
    temperatures = [get_riding_temperature(current["temperature"])]
    temperatures += [point["riding_temperature"] for point in ride_hours_list]
    change = temperatures[-1] - temperatures[0]

    # Regen
    rain = None
    max_rain = max([point["rain_probability"] for point in ride_hours_list], default=0)
    heavy = next((p for p in ride_hours_list if p["rain_probability"] >= RAIN_PROB_HIGH), None)
    if current["precipitation"] > 0:
        rain = "Es regnet gerade"
    elif heavy:
        rain = f"Regen ab ca. {heavy['time'].hour} Uhr ({heavy['rain_probability']} %)"
    elif max_rain >= RAIN_PROB_MODERATE:
        rain = f"Schauer möglich (bis {max_rain} %)"

    # Wind
    wind = None
    max_gusts = max([current["wind_gusts"]] + [p["gusts"] for p in ride_hours_list])
    if current["wind_gusts"] >= GUSTS_STRONG:
        wind = f"Starke Böen (bis {max_gusts:.0f} km/h)"
    else:
        strong = next((p for p in ride_hours_list if p["gusts"] >= GUSTS_STRONG), None)
        if strong:
            wind = f"Böig ab ca. {strong['time'].hour} Uhr (bis {max_gusts:.0f} km/h)"

    # Glätte, die erst während der Fahrt auftritt
    ice_later = next((p for p in ride_hours_list if p["ice"]), None)

    if max_gusts >= GUSTS_MODERATE:
        wind_word = "etwas Wind"
    else:
        wind_word = "kaum Wind"

    return {
        "ride_hours": ride_hours,
        "end": ride_end,
        "timeline": timeline,
        "coldest": min(temperatures),
        "change": change,
        "rain": rain,
        "rain_expected": current["precipitation"] > 0 or max_rain >= RAIN_PROB_MODERATE,
        "wind": wind,
        "wind_word": wind_word,
        "ice_later": ice_later["time"] if ice_later else None,
    }


def pick_from_wardrobe(item, wardrobe):
    """Gibt das empfohlene Teil zurück oder den besten Ersatz aus dem Kleiderschrank.

    Ergebnis: (Name, fehlt) - oder None, wenn eine Unterschicht einfach wegfällt.
    """
    if item in wardrobe:
        return item, False

    zone, role, warmth = CATALOG[item]
    candidates = [
        name for name in wardrobe
        if name in CATALOG and CATALOG[name][0] == zone and CATALOG[name][1] == role
    ]

    if candidates:
        # Am nächsten an der gewünschten Wärme, bei Gleichstand lieber wärmer.
        # Danach entscheidet die Reihenfolge im Katalog (dort stehen leichte Teile vorne):
        # Ersetzen wir ein leichteres Teil, nehmen wir das leichteste passende,
        # ersetzen wir ein wärmeres Teil, das wärmste.
        catalog_order = list(CATALOG)

        def ranking(name):
            candidate_warmth = CATALOG[name][2]
            position = catalog_order.index(name)
            return (
                abs(candidate_warmth - warmth),
                -candidate_warmth,
                position if candidate_warmth > warmth else -position,
            )

        return min(candidates, key=ranking), False

    if role == "outer":
        return item, True  # wichtig, aber nicht im Schrank: trotzdem anzeigen

    return None


def recommend_outfit(coldest, sensitivity, wardrobe, rain_expected, change):
    level = get_clothing_level(coldest, sensitivity)

    zones = []
    for zone_key, zone_name in ZONES:
        layers = []
        for item in OUTFITS[level][zone_key]:
            picked = pick_from_wardrobe(item, wardrobe)
            if picked is None:
                continue
            name, missing = picked
            if any(layer["name"] == name for layer in layers):
                continue
            layers.append({
                "name": name,
                "warmth": WARMTH_WORDS[CATALOG[name][2]],
                "missing": missing,
            })
        zones.append({"zone": zone_name, "layers": layers})

    # Regenschutz
    rain_gear = None
    if rain_expected:
        if RAIN_GEAR_FULL in wardrobe:
            rain_gear = RAIN_GEAR_FULL
        else:
            parts = [part for part in RAIN_GEAR_PARTS if part in wardrobe]
            rain_gear = " + ".join(parts) if parts else "Regenkombi (nicht im Kleiderschrank)"

    tip = None
    if change <= -TREND_CHANGE:
        tip = "Wird während der Fahrt deutlich kälter - lieber gleich warm anziehen."
    elif change >= TREND_CHANGE:
        tip = "Wird während der Fahrt wärmer - eine Schicht zum Ausziehen einplanen."

    return {"level": level, "zones": zones, "rain_gear": rain_gear, "tip": tip}


def build_quick_check(current, hours, now, ride_hours, sensitivity, wardrobe):
    """Fasst alles zusammen - das ist später der Inhalt der Startseite."""
    now_block = analyze_now(current, hours, now)
    ride = analyze_ride(current, hours, now, ride_hours)

    # Ist es jetzt schon glatt, steht die Warnung oben - nicht doppelt im Fahrt-Block
    if now_block["ice"]:
        ride["ice_later"] = None

    outfit = recommend_outfit(ride["coldest"], sensitivity, wardrobe, ride["rain_expected"], ride["change"])

    return {"now": now_block, "ride": ride, "outfit": outfit}


# =====================================================================
# 3. ANZEIGE
# =====================================================================

WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]


def format_hours(ride_hours):
    if ride_hours == 0.5:
        return "30 min"
    if ride_hours == int(ride_hours):
        return f"{int(ride_hours)} h"
    return f"{ride_hours:.1f} h".replace(".", ",")


def print_quick_check(location, now, check):
    now_block = check["now"]
    ride = check["ride"]
    outfit = check["outfit"]

    print("=" * 52)
    print(f"  MOTOWEATHER · {location}")
    print(f"  {WEEKDAYS[now.weekday()]}, {now.day}. {MONTHS[now.month - 1]} · {now:%H:%M}")
    print("=" * 52)
    print()

    # Block 1: JETZT
    print("JETZT - gefühlt auf dem Motorrad")
    print(f"  {now_block['riding_temperature']:.0f}°  {now_block['label'].upper()}"
          f"   (außen {now_block['air_temperature']:.0f}°)")
    if now_block["ice"]:
        print("  ! GLÄTTEGEFAHR - Boden um 0 °C, Brücken und Schattenlagen")
    print()

    # Block 2: DEINE FAHRT
    print(f"DEINE FAHRT - {format_hours(ride['ride_hours'])} (bis {ride['end']:%H:%M})")
    hints = []
    if ride["ice_later"]:
        hints.append(f"Glättegefahr ab ca. {ride['ice_later'].hour} Uhr")
    if ride["rain"]:
        hints.append(ride["rain"])
    if ride["wind"]:
        hints.append(ride["wind"])
    if hints:
        for hint in hints:
            print(f"  ! {hint}")
    else:
        print(f"  Bis {ride['end']:%H:%M}: trocken, {ride['wind_word']}")
    print()

    timeline = ride["timeline"]
    print("  Uhrzeit    " + "".join(f"{p['time']:%H}h".rjust(6) for p in timeline))
    print("  Fahrt °    " + "".join(f"{p['riding_temperature']:.0f}°".rjust(6) for p in timeline))
    print("  Regen %    " + "".join(f"{p['rain_probability']}".rjust(6) for p in timeline))
    print("  Böen km/h  " + "".join(f"{p['gusts']:.0f}".rjust(6) for p in timeline))
    print("  Deine Fahrt" + "".join(("  ====" if p["in_ride"] else "      ") for p in timeline))
    print()

    # Block 3: ANZIEHEN
    print(f"ANZIEHEN - für {ride['coldest']:.0f}° im kältesten Moment (Stufe {outfit['level']})")
    for zone in outfit["zones"]:
        layers = zone["layers"]
        if not layers:
            print(f"  {zone['zone']:<12} nichts extra")
            continue

        outer = layers[-1]
        line = f"  {zone['zone']:<12} {outer['name']} ({outer['warmth']})"
        if outer["missing"]:
            line += " - nicht im Kleiderschrank"
        print(line)

        if len(layers) > 1:
            inner = ", ".join(f"{layer['name']} ({layer['warmth']})" for layer in reversed(layers[:-1]))
            print(f"  {'':<12} + {len(layers) - 1} darunter: {inner}")

    if outfit["rain_gear"]:
        print(f"  {'Regen':<12} {outfit['rain_gear']} mitnehmen")
    else:
        print(f"  {'Regen':<12} nicht nötig")

    if outfit["tip"]:
        print()
        print(f"  Tipp: {outfit['tip']}")

    print()
    print("=" * 52)


# =====================================================================
# PROGRAMMSTART
# =====================================================================

def main():
    now = datetime.now()

    raw = fetch_weather(LATITUDE, LONGITUDE)
    current = parse_current(raw)
    hours = parse_hourly(raw)

    check = build_quick_check(current, hours, now, RIDE_HOURS, COLD_SENSITIVITY, WARDROBE)
    print_quick_check(LOCATION_NAME, now, check)


if __name__ == "__main__":
    main()