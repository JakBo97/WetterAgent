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
Wenn sich Regeln in `logic.js` ändern, sag Bescheid, ob `main.py` nachgezogen werden soll.

## Datenquellen

- **Open-Meteo** Forecast-API (kostenlos, kein Key), `timezone=auto`, `forecast_days=2`.
  Zusätzlich `soil_temperature_0cm` und `dew_point_2m` für die Glätteschätzung.
- **Open-Meteo Geocoding** für die Ortssuche. Nur den Ortsnamen schicken, ohne ", Deutschland".
- **BigDataCloud** reverse-geocode-client für den Ortsnamen bei GPS (bei Fehler: "Mein Standort").
- Keine eigenen Server, keine API-Keys, keine Passwörter ins Repo.

## Fachliche Regeln

- **Fahrtemperatur** = Lufttemperatur + Fahrtwind über die Windchill-Formel mit fester
  Durchschnittsgeschwindigkeit 60 km/h (`AVERAGE_RIDING_SPEED_KMH`). Die Geschwindigkeit ist
  bewusst **keine** Nutzereinstellung. Fahrtwind macht es nur kälter, nie wärmer (`min()`).
- Die Fahrtemperatur ist ein **objektiver Wert** und für alle Fahrer gleich.
- **Kälteempfinden** (Stufe 1 friert schnell … 3 normal … 5 friert nie) verschiebt **nur die
  Kleidungsstufe** (±1/±2), niemals die angezeigte Temperatur.
- **Kleidung** richtet sich nach dem **kältesten Moment der Fahrt**, nicht nach jetzt.
  Kleidungsstufen 1–5 nach Fahrtemperatur: ab 19°, 15–19°, 10–15°, 5–10°, unter 5° (`CLOTHING_LEVELS`).
- **Punktesystem**: Jedes Teil in `CATALOG` hat Zone, Rolle, Wärme (1–3, nur Anzeige) und **Punkte (1–10)**.
  Oberkörper zählt am meisten, dann Unterkörper, dann Schuhe; Kopf und Hände wenig (Sturmhaube 1,
  Halstuch 2). Keine 10 (wäre eine beheizte Winterjacke). `ZONE_NEEDS` legt pro Zone und Stufe fest, wie
  viele Punkte nötig sind; gezählt wird nur Wärme, nicht Schutz.
- **Auswahl** (`selectZone`): pro Zone die Kombination aus dem Kleiderschrank, die den Bedarf deckt und
  am wenigsten darüber liegt; bei Gleichstand weniger Teile. Höchstens ein Teil pro Rolle.
  Reicht der Kleiderschrank nicht, die wärmste Kombination + Hinweis "evtl. zu kalt" (nicht beim Kopf).
  Kopf ohne Bedarf: Sturmhaube als "optional", wenn man eine hat.
- **Kleiderschrank**: Empfohlen wird nur, was man besitzt. Fehlt für eine Zone jedes Außenteil, wird das
  passende mit "nicht im Kleiderschrank" angezeigt. Jede Zone darf im Kleiderschrank leer sein. Beim ersten Öffnen sind nur Textiljacke und Textilhose
  ausgewählt (nicht gesperrt). Umbenannte Teile werden beim Laden übernommen (`RENAMED_ITEMS`),
  Teile, die es nicht mehr gibt, aussortiert.
- **Schutzkleidung** (Einstellung `alwaysGear`, Standard an): An = Jacke, Hose und Handschuhe werden
  immer empfohlen. Aus = in den Zonen `GEAR_ZONES` steht, solange sie keine Wärmepunkte
  brauchen, "Keine Schutzkleidung" + "Schutzkleidung empfohlen"; die Teile erscheinen aufgeklappt als "optional".
  Ein T-Shirt o. Ä. kommt bewusst nicht in den Kleiderschrank.
- **Katalog bewusst schlank**: Kopf nur Sturmhaube + Halstuch (Halstuch nie allein, nur als Zusatz zur
  Sturmhaube, wenn es sehr kalt ist), kein T-Shirt, Jacke und Hose je als Textil
  oder Leder (kein Futter-Unterschied), Handschuhe nur Sommer/Winter, keine Winterstiefel.
- **Mindestanforderung**: Unterschichten (Thermohose, Thermosocken, Thermo-Shirt …) nie ohne Außenteil
  der gleichen Zone. Das stellt `selectZone` sicher (jede Kombination enthält ein Außenteil).
- **Wärmestufen** der Kleidung: 1 leicht, 2 warm, 3 winterfest (0 = Regen).
- **Glätte** (Schätzung): Boden ≤ 1 °C **und** (Regen in den letzten 3 h **oder** Luft nahe Taupunkt).
  Glätte "jetzt" steht im Jetzt-Block, Glätte "später" im Fahrt-Block, nie doppelt.
- **Fahrtdauer-Regler**: 1 bis 8 Stunden in halben Stunden, Standard 1 Stunde. Startzeit ist immer "jetzt".
- **Verlauf** zeigt immer die nächsten 8 Stunden; Stunden außerhalb der Fahrt sind abgeblendet.
- Schwellenwerte stehen als Konstanten oben in `logic.js`, nicht verstreut im Code.

## Design-Entscheidungen (bitte beibehalten)

Startseite mit genau **drei Blöcken**:

1. **JETZT** (späteres iPhone-Widget): große Fahrtemperatur, Tacho von sehr kalt bis heiß mit
   Zeiger, Einordnung als Wort, rundes Feld mit Außentemperatur, "JETZT"-Abzeichen mit
   **rotem pulsierendem Live-Punkt**. Kachel ist in der Temperaturfarbe getönt, Hintergrund
   zeigt eine **Bergkette mit Straße** (bei Frost Schneeflocken, bei Regen Regenstriche, bei Hitze Sonne).
   Nur Glätte "jetzt" erscheint hier als Warnung.
2. **DEINE FAHRT**: Regler mit Strichen pro halber Stunde, darunter Hinweise (Glätte später,
   Regen blau, Wind lila, sonst grüner Haken "trocken"), Stundenverlauf mit Temperaturfarben,
   aufklappbar Regen % und Böen.
3. **ANZIEHEN**: 2×2+2 Kacheln (Kopf, Oberkörper, Hände, Unterkörper, Schuhe, Regen).
   Kachel zeigt das äußerste Teil, "+N Schichten darunter", Farbstreifen pro Schicht.
   Antippen klappt die Schichten auf (auch bei nur einem Teil). Regen-Kachel ist blau, wenn nötig.

Weitere Festlegungen:
- Dunkles Design, Schriften Barlow / Barlow Condensed.
- Markenfarbe Race-Orange `#FF8A3D`. Temperaturfarben: eisblau → blau → türkis → grün → gelb → orange.
- Regen immer blau, Wind immer lila, Glätte orange-gelb.
- Einstellungen: Sprache (EN/DE, Standard Englisch; Deutsch wählt man aktiv), Standort (GPS an/aus + Ortssuche), Kälteempfinden mit
  Live-Beispiel bei aktueller Temperatur (bei "Normal" das ganze Ideal-Outfit mit dem
  typischen Kleiderschrank `REFERENCE_WARDROBE`, sonst nur die Unterschiede
  zu "Normal": + dazu, − weg, "X statt Y"; unabhängig vom Kleiderschrank), Kleiderschrank als An/Aus-Chips nach Zonen
  mit Schalter "Immer mit Schutzkleidung".
- Ersteinrichtung = dieselbe Einstellungsseite mit "Los geht's" statt "Speichern".
- Einstellungen liegen im `localStorage` (Schlüssel `motoweather.settings.v1`), immer in try/catch.
- Touch-Ziele mindestens 44 px, Buttons sind echte `<button>`, Symbole haben `aria-hidden` oder `aria-label`.

## Testen

- Lokal: im Ordner `docs` `python -m http.server` ausführen, dann http://localhost:8000 öffnen.
  (Die `index.html` per Doppelklick zu öffnen funktioniert wegen der JS-Module nicht.)
- **Testmodus**: `?test` an die Adresse hängen (z. B. http://localhost:8000/?test). Dann erscheint über der
  Startseite eine Leiste "Live | 25° | 15° | 5°", die die Lufttemperatur festlegt (`TEST_TEMPERATURES`
  in `app.js`); alles andere bleibt echtes Wetter. Ohne `?test` ist die Leiste unsichtbar.
- **Cache-Busting**: Alle Dateiverweise tragen eine Versionsnummer (z. B. `?v=1`): in `index.html`
  (`style.css`, `js/app.js`) und bei den `import`s oben in `js/app.js`. Pro Commit, der
  `docs/` ändert, die Nummer **einmal und überall gleich** um 1 erhöhen, sonst lädt das iPhone die alte Version.
  Falls der Browser trotzdem noch die alte Version zeigt: **Strg + F5**.
- Logik-Änderungen in `logic.js` mit ein paar Beispielwerten prüfen (warmer Nachmittag mit
  Regen später, eisiger Morgen mit Glätte), bevor die Oberfläche angepasst wird.

## Offene Ideen

- **iPhone-Widget** für den Jetzt-Block über die App Scriptable; Antippen öffnet die Web-App.
- Windchill-Formel ist eigentlich nur bis ca. 10 °C definiert; Berechnung bei warmen Temperaturen überdenken.
- Kleiderschrank verfeinern (z. B. dünne/dicke Socken, Heizweste, Heizgriffe in der Logik nutzen).
- Später vielleicht: Planungsmodus für andere Startzeiten oder Tage.
