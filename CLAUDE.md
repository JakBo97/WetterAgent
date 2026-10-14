# MotoWeather

Private Wetter-App fürs Motorradfahren. Beim schnellen Blick aufs Handy soll man sehen:
Wie kalt fühlt es sich auf dem Motorrad an, was passiert während meiner Fahrt (Regen, Wind,
Glätte) und was ziehe ich an. Die App ist ein **Berater, kein Türsteher**: Sie verbietet nie das
Fahren, sie informiert und empfiehlt Kleidung.

Live: https://jakbo97.github.io/WetterAgent/ (GitHub Pages aus `main`, Ordner `/docs`)

## Über mich und wie wir zusammenarbeiten

- Ich (Jakob) lerne mit diesem Projekt programmieren. Es ist mein erstes Projekt.
- Antworte auf Deutsch, erkläre kurz, *was* du änderst und *warum*, damit ich es nachvollziehen kann.
- Mach kleine, nachvollziehbare Änderungen statt großer Umbauten auf einmal.
- Frag nach, bevor du etwas am Konzept oder Design änderst, das unten als Entscheidung festgehalten ist.
- Commit-Nachrichten auf Deutsch, kurz und beschreibend (z. B. "Regler startet bei 1 Stunde").
- **Vor jedem Commit, der Dateien in `docs/` ändert**, die Versionsnummer `?v=` an allen Stellen
  um eins erhöhen (siehe Cache-Busting unter "Testen"). Genau **einmal pro Commit**, direkt vor dem
  Commit, nicht nach jeder einzelnen Änderung. So werden keine Nummern übersprungen: Steht die Nummer
  schon eins über dem letzten Commit (`git diff`), bleibt sie so.
- Ich nutze Windows, VS Code und ein iPhone.

## Aufbau

```
main.py              Python-Prototyp (Terminal-Ausgabe), gleiche Logik wie die Web-App
docs/                Die Web-App (wird von GitHub Pages ausgeliefert)
  index.html         Grundgerüst, iPhone-Meta-Tags, lädt js/app.js als Modul
  style.css          Komplettes Aussehen, Farben als CSS-Variablen in :root
  manifest.webmanifest, icons/   Für "Zum Home-Bildschirm" auf dem iPhone
  js/data.js         1. DATENQUELLE: Open-Meteo, GPS, Ortssuche
  js/logic.js        2. BEWERTUNG: reine Logik, kein fetch, kein HTML
  js/app.js          3. ANZEIGE: Seiten bauen, Bedienung, Einstellungen speichern
  js/i18n.js         Alle Texte auf Deutsch und Englisch
```

**Die drei Schichten strikt getrennt halten.** Nur `data.js` kennt die Open-Meteo-Namen
(`temperature_2m` usw.). `logic.js` liefert nur Fakten (z. B. `{ kind: "from", hour: 17, probability: 70 }`),
nie fertige Sätze. Alle Texte kommen aus `i18n.js` über `t("schluessel")` bzw. `itemName()`.
Neue Texte immer in **beiden** Sprachen anlegen.

`main.py` ist der ursprüngliche Prototyp. Die Web-App ist inzwischen das Hauptprodukt.
`main.py` rechnet die Fahrtemperatur noch mit der alten Formel (nur Windchill) und hat noch die alte
Kleidungslogik (feste Outfits statt Kleidungstemperatur, Punkte und Schwellen).
Wenn sich Regeln in `logic.js` ändern, sag Bescheid, ob `main.py` nachgezogen werden soll.

## Datenquellen

- **Open-Meteo** Forecast-API (kostenlos, kein Key), `timezone=auto`, `forecast_days=2`.
  Zusätzlich `soil_temperature_0cm` und `dew_point_2m` für die Glätteschätzung.
- **Open-Meteo Geocoding** für die Ortssuche. Nur den Ortsnamen schicken, ohne ", Deutschland".
- **BigDataCloud** reverse-geocode-client für den Ortsnamen bei GPS (bei Fehler: "Mein Standort").
- Keine eigenen Server, keine API-Keys, keine Passwörter ins Repo.

## Fachliche Regeln

- **Fahrtemperatur** (`getRidingBreakdown` in `logic.js`) = Luft + Fahrtwind + Sonne + Regen.
  Gibt `{ air, wind, sun, rain, riding }` zurück; `getRidingTemperature` liefert nur `riding`.
  Bekommt immer das ganze Wetter-Objekt (jetzt oder Stunde), nicht nur die Temperatur.
  - **Fahrtwind**: feste 60 km/h (`AVERAGE_RIDING_SPEED_KMH`, bewusst **keine** Nutzereinstellung),
    plus Wetterwind auf Fahrerhöhe (`WIND_HEIGHT_FACTOR` 0,67): `vEff = √(60² + (0,67·Wind)²)`.
    Bis 10 °C (`WINDCHILL_MAX_TEMP`) Windchill-Formel (JAG/TI); darüber wird die Kühlung bei 10 °C
    linear bis 0 bei `SKIN_TEMP` 33 °C kleiner, darüber wärmt der Fahrtwind, höchstens +2 °C
    (`HEAT_WIND_MAX_BONUS`).
  - **Sonne**: `shortwave_radiation`, `min(4, 0,70 · 0,25·Strahlung / (vEff/3,6 + 10))`
    (`SUN_ABSORB_FACTOR`, `SUN_MAX_BONUS`).
  - **Regen**: ab 0,1 mm/h −2 °C, ab 2 mm/h −3 °C (`RAIN_LIGHT_*`, `RAIN_MODERATE_*`).
  - Ergebnis auf eine Nachkommastelle gerundet.
- Die Fahrtemperatur ist ein **objektiver Wert** und für alle Fahrer gleich.
- **Kleidungstemperatur** = Fahrtemperatur im **kältesten Moment der Fahrt** + `SENSITIVITY_STEP` (4) ×
  (Kälteempfinden − 3). Kälteempfinden Stufe 1 (friert schnell) rechnet 8 °C kälter, 5 (friert nie)
  8 °C wärmer. Das ändert **nur die Kleidung**, niemals die angezeigte Temperatur.
- **Kleiderschrank** (`CATALOG`): Kopf Halstuch, Sturmhaube · Oberkörper Textiljacke, Lederjacke,
  Heizweste · Hände Sommer-, Winterhandschuhe · Unterkörper Thermohose, Motorradjeans, Textilhose,
  Lederhose · Schuhe Thermosocken, Motorrad-Sneaker, Motorradstiefel · Regen Regenkombi.
  Shirts und Pullover stehen bewusst **nicht** im Kleiderschrank: am Oberkörper gibt es dafür die
  allgemeinen Schichten "leicht" und "warm" (`LAYER_TYPES`), die jeder hat. Beim ersten Öffnen sind nur
  Textiljacke und Textilhose ausgewählt. Unbekannte gespeicherte Teile werden ignoriert bzw. beim Laden
  aussortiert, umbenannte übernommen (`RENAMED_ITEMS`).
- **Oberkörper: Punktesystem** (`recommendTorso`): Jacke 5, leichte Schicht 2, warme Schicht 3,
  Heizweste 6 (nur wenn vorhanden). T-Shirt zählt nicht. Unter der Jacke höchstens 2 Schichten
  (Heizweste zählt mit), warme Schicht darf doppelt sein, leichte nicht.
  Bedarf nach Kleidungstemperatur (`TORSO_NEEDS`): ≥ 19: 5 · 15–19: 7 · 10–15: 8 · 5–10: 10 · 0–5: 11 ·
  < 0: 14; bei starken Böen +1. Gewählt wird die kleinste Summe, die reicht, bei Gleichstand weniger
  Teile. Reicht keine: die wärmste + Hinweis `heatedVestWouldHelp` (ohne Heizweste) bzw. `maxWarmth`.
  Keine Jacke im Kleiderschrank: 0 Jackenpunkte + Hinweis `noJacket`.
- **Andere Zonen: Schwellen** nach Kleidungstemperatur (Konstanten oben in `logic.js`):
  - Unterkörper: ≥ 17 Motorradjeans (wenn vorhanden), sonst Kombi-Hose; < 10 zusätzlich Thermohose.
  - Hände: ≥ 10 Sommer-, sonst Winterhandschuhe (immer Handschuhe, auch ohne Schutzkleidung).
  - Schuhe: ≥ 19 Motorrad-Sneaker (wenn vorhanden), sonst Stiefel; < 5 zusätzlich Thermosocken.
  - Kopf: Sturmhaube immer, wenn vorhanden; Halstuch zusätzlich < 12 (bei starken Böen < 16).
    Das Halstuch darf auch allein kommen, wenn keine Sturmhaube da ist.
  - Fehlt das passende Paar (Handschuhe, Schuhe), das andere vorhandene nehmen. Ist für Hände, Schuhe
    oder Hose gar nichts da, wird das passende Teil mit "nicht im Kleiderschrank" angezeigt.
  - Thermohose und Thermosocken kommen nur zusätzlich zu Hose bzw. Schuhen, nie allein.
- **Kombi-Regel** (`chooseKombi`): Jacke und Hose aus demselben Material (Textil/Leder), Motorradjeans
  passt zu beiden. Sind beide Jacken da, gilt die Einstellung `preferredKombi` – außer es ist Regen zu
  erwarten: dann Textil (Hinweis `kombiRainSwitch`). Fehlt die passende Hose, die andere nehmen
  (lieber eine Hose als keine), danach die Jeans.
- **Schutzkleidung**: `protectionTop` ("Motorradjacke immer") und `protectionBottom` ("Motorradhose
  immer"), beide Standard an. Aus: ab Kleidungstemperatur 19 (oben) bzw. 17 (unten) "Nur T-Shirt" bzw.
  "Normale Hose" (Hinweise `noProtectionTop`, `noProtectionBottom`), darunter normale Logik mit Jacke/Hose,
  weil sie dann zum Wärmen gebraucht werden. Alte Einstellung `alwaysGear: false` wird auf beide übertragen.
- **Starke Böen** (≥ `GUSTS_STRONG` jetzt oder während der Fahrt) wirken nur am Oberkörper (+1) und
  beim Halstuch.
- Hinweise liefert `logic.js` nur als Schlüssel, die Texte stehen in `i18n.js`.
- **Wärmestufen** der Kleidung: 1 leicht, 2 warm, 3 winterfest (0 = Regen).
- **Glätte** (Schätzung): Boden ≤ 1 °C **und** (Regen in den letzten 3 h **oder** Luft nahe Taupunkt).
  Glätte "jetzt" steht im Jetzt-Block, Glätte "später" im Fahrt-Block, nie doppelt.
- **Fahrtdauer-Regler**: 0 ("Jetzt", live) bis 8 Stunden in halben Stunden, Standard 0. Startzeit ist
  immer "jetzt". Der Regler steuert die große Zahl oben: Sie zeigt die Fahrtemperatur am **Ende** der
  eingestellten Fahrt (`ride.endMoment` bzw. `check.moment`). Zwischen zwei vollen Stunden rechnet
  `weatherAt` Temperatur und Wind anteilig, Regen und Sonne aus der Stunde, in die der Zeitpunkt fällt.
  Dieser Endpunkt zählt auch für den kältesten Moment der Fahrt.
- **Einordnung** (`FEEL_BANDS`) fürs Motorradfahren in 4 Bereichen: Kalt < 8 · Kühl < 16 · Angenehm < 26 ·
  Heiß ab 26 (Fahrtemperatur).
- **Verlauf** (aufklappbar "Regen & Wind im Verlauf") zeigt immer die nächsten 8 Stunden mit Uhrzeit,
  Regen % und Böen; Stunden außerhalb der Fahrt sind abgeblendet. Die Temperatur steht dort nicht mehr,
  sie steht oben in der großen Anzeige.
- Schwellenwerte stehen als Konstanten oben in `logic.js`, nicht verstreut im Code.

## Design-Entscheidungen (bitte beibehalten)

Startseite mit genau **drei Blöcken**:

1. **JETZT** (späteres iPhone-Widget): große Fahrtemperatur, Tacho mit 4 Bereichen (kalt, kühl,
   angenehm, heiß) von 0 °C (darunter ganz links) bis 35 °C (voll ausgeschlagen) mit Zeiger,
   Einordnung als Wort, rundes Feld mit Außentemperatur. Zeit-Abzeichen in der Temperaturfarbe (gefüllt, gleiche Form
   in beiden Fällen): Regler auf 0 → "**● 20:59** jetzt" mit **rotem pulsierendem Live-Punkt**; sonst
   "Uhr-Symbol **22:53** in 2 h" für den eingestellten Zeitpunkt, und Zahl, Tacho, Außentemperatur und
   Farbe wandern mit. Kachel ist in der Temperaturfarbe getönt, Hintergrund
   zeigt eine **Bergkette mit Straße** (bei Frost Schneeflocken, bei Regen Regenstriche, bei "angenehm" eine gelbe Sonne, bei "heiß"
   eine große orange Sonne mit flimmernder Luft).
   Nur Glätte "jetzt" erscheint hier als Warnung (immer, weil die Fahrt jetzt losgeht).
2. **DEINE FAHRT**: Regler mit Strichen pro halber Stunde (links "Jetzt"), darunter Hinweise (Glätte
   später, Regen blau, Wind lila, sonst grüner Haken "trocken"), aufklappbar Uhrzeiten, Regen % und Böen.
3. **ANZIEHEN**: 2×2+2 Kacheln (Kopf, Oberkörper, Hände, Unterkörper, Schuhe, Regen).
   Kachel zeigt das äußerste Teil, "+N Schichten darunter", Farbstreifen pro Schicht.
   Oberkörper: groß die Jacke (oder "Nur T-Shirt"), darunter "+ 1 warme Schicht" / "+ 2 Schichten";
   Farbstreifen Jacke zuerst, dann je Schicht (leicht/warm/Heizweste = winterfest). Kopf: "Sturmhaube"
   + "+ Halstuch". Antippen klappt die Schichten auf (von außen nach innen, auch bei nur einem Teil);
   allgemeine Schichten mit Beispiel-Hinweis (z. B. "Pullover, Thermo-Shirt oder das Futter deiner Jacke").
   Hinweise unauffällig in Kachel bzw. Aufklappliste, `kombiRainSwitch` als Satz im Tipp-Bereich.
   Regen-Kachel ist blau, wenn nötig.

Weitere Festlegungen:
- Dunkles Design, Schriften Barlow / Barlow Condensed.
- Markenfarbe Race-Orange `#FF8A3D`. Temperaturfarben: eisblau (kalt) → türkis (kühl) → grün (angenehm) → orange (heiß).
- Regen immer blau, Wind immer lila, Glätte orange-gelb.
- Einstellungen: Sprache (EN/DE, Standard Englisch; Deutsch wählt man aktiv), Standort (GPS an/aus + Ortssuche), Kälteempfinden mit
  Live-Beispiel bei aktueller Fahrtemperatur (Oberkörper: Jacke + Schichten, mit einer Textiljacke,
  unabhängig vom Kleiderschrank; bei anderer Stufe als "Normal" zum Vergleich, was "Normal" wäre),
  Kleiderschrank als An/Aus-Chips nach Zonen, Schalter "Motorradjacke immer" / "Motorradhose immer"
  (ist einer aus, einmal ein sachlicher Hinweis darunter, kein Banner auf der Startseite),
  "Bevorzugte Kombi" Textil/Leder nur sichtbar, wenn beide Jacken angehakt sind.
- Ersteinrichtung = dieselbe Einstellungsseite mit "Los geht's" statt "Speichern".
- Einstellungen liegen im `localStorage` (Schlüssel `motoweather.settings.v1`), immer in try/catch.
- Touch-Ziele mindestens 44 px, Buttons sind echte `<button>`, Symbole haben `aria-hidden` oder `aria-label`.

## Testen

- Lokal: im Ordner `docs` `python -m http.server` ausführen, dann http://localhost:8000 öffnen.
  (Die `index.html` per Doppelklick zu öffnen funktioniert wegen der JS-Module nicht.)
- **Testmodus**: `?test` an die Adresse hängen (z. B. http://localhost:8000/?test). Dann erscheint über der
  Startseite eine Leiste "Live | 25° | 15° | 5°", die die Lufttemperatur **jetzt** festlegt
  (`TEST_TEMPERATURES` in `app.js`). Der echte Temperaturverlauf wird dabei nur verschoben (wird es real
  4 °C kälter, auch im Test), damit sich die Anzeige beim Bewegen des Reglers ändert; alles andere bleibt
  echtes Wetter. Ohne `?test` ist die Leiste unsichtbar.
- **Cache-Busting**: Alle Dateiverweise tragen eine Versionsnummer (z. B. `?v=1`): in `index.html`
  (`style.css`, `js/app.js`) und bei den `import`s oben in `js/app.js`. Pro Commit, der
  `docs/` ändert, die Nummer **einmal und überall gleich** um 1 erhöhen, sonst lädt das iPhone die alte Version.
  Falls der Browser trotzdem noch die alte Version zeigt: **Strg + F5**.
- Logik-Änderungen in `logic.js` mit ein paar Beispielwerten prüfen (warmer Nachmittag mit
  Regen später, eisiger Morgen mit Glätte), bevor die Oberfläche angepasst wird.

## Offene Ideen

- **iPhone-Widget** für den Jetzt-Block über die App Scriptable; Antippen öffnet die Web-App.
- Kleiderschrank verfeinern (z. B. dünne/dicke Socken, Heizweste, Heizgriffe in der Logik nutzen).
- Später vielleicht: Planungsmodus für andere Startzeiten oder Tage.
- Kälteempfinden mitlernen – Konzept noch offen, aber keine Abfrage nach jeder Fahrt.
