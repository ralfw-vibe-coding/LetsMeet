# LetsMeet Entscheidungen

Stand: 2026-06-09

Diese Datei ergaenzt die Produktvision in `requirements/app vision.md`. Sie haelt die konkret geklaerten MVP-Entscheidungen fest.

## Grundidee

- Die Anwendung heisst "LetsMeet".
- Der Claim lautet: "The easy way to agree on time together".
- Die App ist eine einfache Doodle-Alternative ohne Benutzerkonten.
- Es gibt keine klassische Authentifizierung.
- Es werden keine E-Mail-Adressen und keine Klarnamen verlangt.
- Teilnehmer verwenden ein Pseudonym, das innerhalb eines Meetings eindeutig sein muss.
- Meetings werden erstmal dauerhaft gespeichert. Eine automatische Loeschung kann spaeter ergaenzt werden, z. B. nach einer gewissen Zeit nach dem letzten finalen Termin.

## Tech Stack und Betrieb

- Die Anwendung wird als Node.js-Anwendung in TypeScript gebaut.
- Die UI wird mit React umgesetzt.
- Fuer UI-Komponenten wird shadcn/ui verwendet.
- Fuer Icons wird lucide verwendet.
- Die Oberflaeche soll modern wirken.
- Buttons sollen bevorzugt als Icon-Buttons umgesetzt werden, wo das fachlich eindeutig ist.
- Die App wird als React/Vite-Frontend plus Netlify Functions als Backend in derselben Codebase gebaut.
- Die Persistenz liegt in Postgres.
- Als Postgres-Provider wird Neon verwendet.
- Die Datenbankverbindung wird ueber `DATABASE_URL` in `.env` bereitgestellt.
- `.env` darf nicht versioniert werden.
- Das Deployment des Codes erfolgt bei Netlify.
- Fuer Request-, Response- und JSON-Dokument-Validierung wird `zod` verwendet.
- Es wird kein ORM verwendet.
- Der Datenbankzugriff erfolgt ueber schlanken SQL-Zugriff und handgeschriebene Queries.
- Datenbankmigrationen werden als versionierte SQL-Dateien im Repo abgelegt, z. B. unter `database/migrations/001_initial.sql`.
- Ein kleines TypeScript-Script soll Migrationen gegen `DATABASE_URL` anwenden koennen.

## Datenmodell

- Es gibt zwei Haupttabellen: `meetings` und `votes`.
- Fachliche Meetingdaten werden als `jsonb` in `meetings.data` gespeichert.
- Fachliche Vote-Daten werden als `jsonb` in `votes.data` gespeichert.
- Technische Identitaet, Zugriff und Lebenszyklusdaten bleiben als relationale Spalten erhalten.
- `meetings` enthaelt mindestens:
  - `id uuid primary key`
  - `edit_id uuid unique not null`
  - `data jsonb not null`
  - `created_at timestamptz not null`
  - `updated_at timestamptz not null`
  - `closed_at timestamptz null`
- `votes` enthaelt mindestens:
  - `id uuid primary key`
  - `meeting_id uuid not null references meetings(id)`
  - `participant_id uuid not null`
  - `data jsonb not null`
  - `created_at timestamptz not null`
  - `updated_at timestamptz not null`
  - `unique(meeting_id, participant_id)`
- Der aktuelle Gesamtzustand eines Meetings wird beim Lesen serverseitig aus `meetings` und den zugehoerigen `votes` zusammengesetzt.
- Beim Speichern sendet die UI nur den Anteil ans Backend, der fuer die jeweilige Aktion relevant ist.

## Architektur und API

- Die Backend-API wird slice-orientiert gebaut.
- Slices orientieren sich an Nutzeraktionen.
- Es gibt kleine Endpunkte pro Aktion statt eines generischen "save everything"-Endpunkts.
- Erste MVP-Slices:
  - `CreateMeeting`
  - `GetOrganizerMeeting`
  - `UpdateMeeting`
  - `GetParticipantMeeting`
  - `SubmitVote`
  - `CloseVoting`
  - `SetFinalProposals`
  - `VerifyParticipantPin`
- Die UI-Routen sind:
  - `/` fuer ein neues Meeting
  - `/m/:meetingId` fuer die Teilnehmeransicht
  - `/m/:meetingId/edit/:editId` fuer die Veranstalteransicht
- Nicht existierende Meeting-IDs oder nicht passende Edit-IDs fuehren zu einem neutralen "Meeting nicht gefunden" / "Meeting not found".

## Arbeitsweise

- Nach Code- oder Dokumentationsaenderungen soll gefragt werden, ob die Aenderungen committed werden sollen.
- Wenn committed wird, soll der Commit eine gute Commit Message und einen Beschreibungstext enthalten.
- Nach Aenderungen soll klar benannt werden, was zur Abnahme angeschaut oder getestet werden soll.

## Meeting-Erstellung

- Beim Oeffnen der App wird noch kein Meeting-Datensatz erzeugt.
- Der Veranstalter sieht zuerst ein leeres neues Meeting.
- Ein Meeting entsteht erst durch explizites Speichern.
- Nach dem ersten Speichern entstehen der Abstimmungslink und der Bearbeitungslink.
- Auch spaetere Aenderungen des Veranstalters werden explizit gespeichert.
- Der Speichern-Button fuer Meetingdaten und Vorschlaege sitzt im Kalenderbereich, nicht unter den Meetingdetails.
- Der Speichern-Button ist deaktiviert, solange kein Titel vergeben wurde oder kein Terminvorschlag existiert.
- Die Meetingdetails-Spalte kann im Veranstaltermodus ueber ein kleines Icon ein- und ausgeklappt werden.
- Es gibt kein Feld fuer die Anzahl finaler Termine.
- Der Veranstalter kann in der Beschreibung mitteilen, um wie viele Termine es geht.
- Die Dauer gilt gemeinsam fuer alle Terminvorschlaege eines Meetings.
- Die Dauer wird als `durationMinutes` gespeichert.
- Die Dauer muss mindestens 15 Minuten und maximal 480 Minuten betragen.
- Die Dauer muss in 15-Minuten-Schritten liegen.
- Ein Meeting-Titel ist Pflicht.
- Die Beschreibung ist optional.
- Der Titel ist nach Trim 1 bis 120 Zeichen lang.
- Die Beschreibung ist optional und maximal 2000 Zeichen lang.
- Ein Meeting muss mindestens einen Terminvorschlag haben, bevor es gespeichert werden kann.

## Links, IDs und PIN

- Links enthalten interne, schwer ratbare UUIDs.
- Der Abstimmungslink funktioniert ueber eine Meeting-ID.
- Der Bearbeitungslink verwendet zusaetzlich eine separate Edit-ID, die zum selben Meeting gehoert.
- Es gibt optional eine Teilnehmer-PIN.
- Ist eine PIN gesetzt, muessen Teilnehmer sie beim Oeffnen des Abstimmungslinks eingeben.
- Ist die PIN leer, ist keine PIN erforderlich.
- Die PIN kann automatisch generiert und manuell geaendert werden.
- Die PIN ist ein einfacher sechsstelliger numerischer Code ohne hohe Security-Ansprueche.
- Die PIN wird als zwei Dreiergruppen angezeigt, z. B. `123 456`.
- Intern wird die PIN normalisiert ohne Leerzeichen gespeichert und geprueft, z. B. `123456`.
- Der Veranstalter darf die PIN manuell aendern, solange sie genau sechs Ziffern hat.
- Nach erfolgreicher PIN-Pruefung merkt sich der Browser die Freigabe lokal pro Meeting.
- Eine falsche Teilnehmer-PIN wird klar als falsche PIN angezeigt.
- Im MVP gibt es kein serverseitiges Rate Limiting fuer PIN-Versuche.
- Im MVP gibt es kein separates Veranstalter-Passwort; der geheime Bearbeitungslink reicht.

## Terminvorschlaege

- Terminvorschlaege speichern nur UTC-Zeitpunkte.
- Ein Vorschlag besteht fachlich aus einem Startzeitpunkt; die Endzeit ergibt sich aus der gemeinsamen Dauer.
- Vorschlaege koennen frei ueber mehrere Tage oder Wochen verteilt werden.
- Kalender-Slots haben eine Granularitaet von 15 Minuten.
- Terminvorschlaege muessen serverseitig exakt auf dem 15-Minuten-Raster liegen.
- Ein Vorschlag belegt im Kalender so viele 15-Minuten-Bloecke, wie seiner Dauer entsprechen.
- Terminvorschlaege eines Meetings duerfen sich zeitlich nicht ueberlappen.
- Ein Terminvorschlag darf nur angelegt werden, wenn seine volle Dauer in den konfigurierten Tageszeitraum passt.
- Der Veranstalter fuegt Vorschlaege per Klick in freie Kalender-Slots hinzu.
- Ein Klick auf einen vorhandenen Vorschlag entfernt ihn.
- Es gibt im MVP keine direkte "Vorschlag aendern"-Funktion.
- Aendern wird technisch und fachlich als Entfernen des alten Vorschlags plus Hinzufuegen eines neuen Vorschlags behandelt.
- Dragging oder Resizing ist nicht Teil des MVP.
- Wenn ein Vorschlag nachtraeglich geaendert oder geloescht wird, verfallen die bisherigen Stimmen fuer diesen Vorschlag.
- Wenn der Veranstalter einen Vorschlag entfernt, werden Stimmen darauf automatisch aus allen Votes entfernt.
- Teilnehmer koennen nur fuer Vorschlaege abstimmen, die aktuell im Meeting existieren.
- Unbekannte Proposal-IDs in einem Vote werden als Validierungsfehler abgelehnt.

## Veranstalter-Kalender

- Die Veranstalter-Kalenderansicht zeigt im MVP einen horizontal scrollbarbaren Zeitraum statt Navigation per Woche.
- Der sichtbare Zeitraum startet immer beim heutigen Datum.
- Die Ansicht enthaelt alle erlaubten Tage bis zum maximalen Datum.
- Zwischen Tagen gibt es klare vertikale Trennlinien.
- Vor Montagen wird eine staerkere vertikale Linie angezeigt.
- Wenn Wochenenden angezeigt werden, werden sie visuell leicht hervorgehoben.
- Der Veranstalter kann einen Eingabebereich konfigurieren:
  - maximales Datum fuer Vorschlaege, Default z. B. vier Wochen ab heute
  - Tageszeitraum, Default z. B. 09:00 bis 16:00
  - Wochenenden ein- oder ausblenden, Default: keine Wochenenden
- Diese Anzeige- und Eingabeeinstellungen werden dauerhaft am Meeting gespeichert.
- Sie sind eine Eingabehilfe fuer den Veranstalter, nicht die Teilnehmeransicht.
- Der Veranstalter kann Vorschlaege nur im aktuell sichtbaren Eingabebereich platzieren.
- Der Eingabebereich kann geaendert werden.
- Bestehende Vorschlaege bleiben erhalten, auch wenn sie nach einer Bereichsaenderung ausserhalb des sichtbaren Bereichs liegen.
- Vorschlaege ausserhalb des sichtbaren Bereichs sollten nicht automatisch geloescht werden.
- Neue Vorschlaege muessen innerhalb des aktuell gespeicherten Eingabebereichs liegen.
- Das maximale Datum des Eingabebereichs ist inklusiv.
- Default fuer das maximale Datum ist heute plus 28 Tage.
- `dayStart` und `dayEnd` muessen auf 15-Minuten-Grenzen liegen.
- `dayEnd` muss am selben Tag nach `dayStart` liegen.
- Tageszeitraeume ueber Mitternacht sind im MVP nicht erlaubt.

## Zeitzonen

- Es gibt keine fachliche Meeting-Zeitzone.
- Gespeichert werden nur UTC-Zeiten.
- Jeder angezeigte Termin wird aus UTC in eine Anzeige-Zeitzone umgerechnet.
- Teilnehmer sehen Termine automatisch in ihrer Browser-Zeitzone.
- In Teilnehmeransichten wird sichtbar angezeigt, in welcher lokalen Zeitzone Zeiten dargestellt werden.
- Der Veranstalter kann im Bearbeitungsmodus eine Bearbeitungs-Zeitzone einstellen.
- Default fuer die Bearbeitungs-Zeitzone ist die Browser-Zeitzone beim Anlegen.
- Die Bearbeitungs-Zeitzone gilt nur fuer Anzeige und Eingabe im Veranstalter-Kalender.
- Wenn der Veranstalter die Bearbeitungs-Zeitzone aendert, bleiben bestehende Vorschlaege dieselben UTC-Zeitpunkte und werden nur anders dargestellt.
- Wenn der Veranstalter in der aktuell gewaehlten Bearbeitungs-Zeitzone einen neuen Vorschlag klickt, wird daraus ein neuer UTC-Zeitpunkt gespeichert.
- Teilnehmer koennen im MVP keine eigene Anzeige-Zeitzone auswaehlen.
- Beim Kopieren der finalen Ergebnisliste soll der Veranstalter waehlen koennen, in welcher Zeitzone die Termine ausgegeben werden. Default ist die aktuell gewaehlte Bearbeitungs-Zeitzone.
- Die Zeitzonenanzeige nennt immer auch den IANA-Zeitzonennamen, z. B. `Europe/Berlin`.
- Die Bearbeitungs-Zeitzone wird aus einer durchsuchbaren Liste von IANA-Zeitzonen gewaehlt.
- Die Zeitzonenliste verwendet nach Moeglichkeit `Intl.supportedValuesOf('timeZone')` und hat einen kleinen Fallback.
- Ausgewaehlte Zeitzonen werden lokal im Browser als Favoriten wiederholt angeboten.
- Favoriten koennen aus der Zeitzonenauswahl wieder entfernt werden.

## Sprache und Lokalisierung

- Die UI unterstuetzt Deutsch und Englisch.
- Die Sprachwahl wird lokal im Browser gespeichert und ist nicht Teil des Meetings.
- Default ist die Browser-Sprache.
- Browser-Sprachen mit `de*` verwenden Deutsch; alle anderen fallen auf Englisch zurueck.
- UI-Texte werden im MVP ueber ein kleines eigenes `i18n`-Dictionary fuer `de` und `en` gepflegt.
- Es wird keine grosse i18n-Library verwendet.
- Der Claim bleibt immer Englisch.
- Datums- und Zeitformate haengen von der gewaehlten UI-Sprache ab.
- Kopierbare Ergebnislisten unterstuetzen Deutsch und Englisch entsprechend der aktuell gewaehlten UI-Sprache.
- Die Ergebnisliste nennt die gewaehlte Ausgabe-Zeitzone sichtbar.

## Teilnehmer

- Ein Teilnehmer muss vor dem Speichern ein Pseudonym angeben.
- Das Pseudonym muss innerhalb des Meetings eindeutig sein.
- Der Teilnehmer wird beim erstmaligen Oeffnen eines Meetings intern fuer dieses Meeting identifiziert.
- Im selben Browser wird er spaeter wiedererkannt.
- Ein wiedererkannter Teilnehmer kann seine bisherige Auswahl ohne erneute Namenseingabe bearbeiten.
- Der Teilnehmer darf sein Pseudonym spaeter aendern, solange es eindeutig bleibt.
- Ein Teilnehmer zaehlt erst als bekannter Teilnehmer, wenn er explizit gespeichert hat.
- Ein Teilnehmer darf auch eine leere Auswahl speichern. Das bedeutet: Keiner der Vorschlaege passt.
- Eine leere gespeicherte Auswahl zaehlt trotzdem als abgegebene Stimme.
- Nur das Oeffnen des Links, Namenseingabe oder Herumklicken zaehlt noch nicht als Abstimmung.
- Der Button "Alle auswaehlen" waehlt alle Vorschlaege des Meetings aus.
- Die lokale Teilnehmer-ID wird pro Meeting in `localStorage` gespeichert.
- Die Teilnehmer-ID wird beim ersten Oeffnen der Teilnehmeransicht im Browser erzeugt.
- Sie wird erst mit `SubmitVote` in der Datenbank relevant.
- Pseudonyme werden vor Validierung und Speicherung getrimmt.
- Pseudonyme muessen nach Trim 1 bis 40 Zeichen lang sein.
- Pseudonyme sind innerhalb eines Meetings case-insensitive eindeutig.
- `ralf` und `Ralf` gelten also als derselbe Name.

## Teilnehmer-Kalender

- Teilnehmer sehen nicht die Eingabeeinstellungen des Veranstalters.
- Teilnehmer sehen die Terminvorschlaege als Kalender, nicht als einfache Kartenliste.
- Ueber dem Teilnehmer-Kalender steht eine kurze Handlungsanweisung, z. B. "Klicke alle Terminvorschlaege, die dir passen."
- Nicht ausgewaehlte Terminvorschlaege bleiben im Teilnehmer-Kalender sichtbar und werden grau dargestellt.
- Beim Oeffnen der Teilnehmeransicht ist zunaechst kein Vorschlag ausgewaehlt.
- Vorschlaege werden im Teilnehmer-Kalender deutlich als solche markiert, z. B. mit Rahmen und Anzeige "Vorschlag #n".
- Die Nummerierung ist nur eine Anzeigehilfe und wird fortlaufend aus der Darstellung berechnet.
- Ausgewaehlte Terminvorschlaege werden gruen mit Haken dargestellt.
- Ein erneuter Klick auf einen ausgewaehlten Vorschlag waehlt ihn wieder ab und zeigt ihn wieder grau.
- Der Button "Alle" waehlt alle Terminvorschlaege aus; danach koennen einzelne wieder abgewaehlt werden.
- Die Teilnehmeransicht bestimmt ihren Bereich automatisch aus den vorhandenen Vorschlaegen.
- Der Bereich reicht vom fruehesten bis zum spaetesten Vorschlag.
- Das Tageszeitfenster wird sinnvoll aus Start- und Endzeiten der Vorschlaege abgeleitet.
- Leere Wochenenden werden nicht gezeigt, sofern dort keine Vorschlaege liegen.
- Ein Teilnehmer kann erst abstimmen, wenn er ein Pseudonym eingegeben hat.
- Das Pseudonym-Feld wird als Pflichtfeld markiert.
- Nach dem Speichern einer Stimme wird ein kurzes Overlay-Feedback angezeigt.

## Auswertung

- Der Veranstalter sieht, wie viele bekannte Teilnehmer bisher gespeichert haben.
- Die Veranstalteransicht hat zwei Modi: `Vorschlagen` und `Auswerten`.
- Nach dem ersten Speichern eines Meetings startet der Veranstalter beim Oeffnen des Bearbeitungslinks im Modus `Auswerten`.
- Im Modus `Vorschlagen` kann der Veranstalter die Meetingdaten und Terminvorschlaege bearbeiten, solange die Abstimmung offen ist.
- Im Modus `Auswerten` sieht der Veranstalter die Rueckmeldungen direkt im Kalender an den Vorschlagsbloecken.
- In den Vorschlagsbloecken sieht der Veranstalter auf einen Blick nur Vorschlagnummer, Zustimmung als `Ja/Gesamt (Prozent)` und einen kontrastreichen Zustimmungsbalken.
- Wer genau wie abgestimmt hat, sieht der Veranstalter erst nach Klick auf einen Vorschlag in einem Overlay.
- Das Overlay erscheint unter dem angeklickten Kopfbereich, leicht nach rechts versetzt.
- Das Overlay ist ungefaehr so schmal wie eine Tagesspalte.
- Nur der Kopfbereich eines Vorschlags mit den Fortschrittsinformationen ist klickbar und zeigt den Hand-Cursor.
- Das Overlay kann mit `Esc` geschlossen werden.
- Das Overlay hat ein `x` zum Schliessen; ein zusaetzlicher Schliessen-Button ist nicht noetig.
- Das Overlay zeigt alle bekannten Teilnehmer alphabetisch untereinander; wer zugestimmt hat, hat einen Haken, die anderen haben keinen Haken.
- Nach dem Schliessen der Abstimmung werden finale Termine im Modus `Auswerten` ueber das Vorschlags-Overlay markiert.
- Das Speichern finaler Termine gibt sichtbares Feedback.
- Im Auswertemodus erscheint nach dem Schliessen eine kompakte Liste der aktuell ausgewaehlten finalen Termine.
- Wenn keine finalen Termine ausgewaehlt sind, wird das explizit angezeigt.
- ICS-Download-Buttons werden erst angezeigt, wenn finale Termine gespeichert sind.
- Es gibt keine Soll-Liste von Teilnehmern und daher keine Anzeige fehlender Teilnehmer.
- Die Hitliste der Vorschlaege wird nach Zustimmungszahl absteigend und danach nach Datum/Uhrzeit aufsteigend sortiert.
- Im Kalender sieht der Veranstalter pro Vorschlag die Zustimmungszahl.
- Im Veranstalter-Kalender sollen Vorschlagsbloecke waehrend der Abstimmung sichtbar zeigen, zu welchem Vorschlag Stimmen vorliegen, z. B. `Vorschlag #n · Ja/Gesamt`.
- Die relative Zustimmung wird visuell hervorgehoben.
- Fuer jeden Vorschlag kann der Veranstalter sehen, welche bekannten Teilnehmer zugestimmt haben und welche nicht.
- Die Veranstalteransicht zeigt auch waehrend der offenen Abstimmung eine gut sichtbare Auswertung pro Vorschlag.
- Jeder Vorschlag in der Auswertung zeigt mindestens Vorschlagnummer, Zustimmung als `Ja/Gesamt (Prozent)` und Prozentbalken.
- Die relative Zustimmung wird als Anteil an allen bekannten Teilnehmern berechnet.
- Beispiel: 3 Zustimmungen bei 4 bekannten Teilnehmern ergeben 75 Prozent Zustimmung.
- Bei 0 bekannten Teilnehmern wird Zustimmung neutral dargestellt, ohne visuelle Hervorhebung und mit 0 Stimmen.
- Die Veranstalteransicht zeigt vor dem Schliessen bereits Auswertung und Teilnehmerdetails.
- Teilnehmer sehen vor dem Schliessen keine laufende Hitliste und keine Teilnehmer-Auswertung.
- Teilnehmer sehen nach dem Schliessen finale Termine, aber keine Teilnehmerdetails.
- Teilnehmer sehen nach dem Schliessen ihre eigene abgegebene Auswahl lesend, wenn derselbe Browser wiedererkannt wird.

## Abstimmung Schliessen und Finale Termine

- Der Veranstalter kann die Abstimmung explizit schliessen.
- `CloseVoting` ist im MVP irreversibel.
- Nach dem Schliessen koennen Teilnehmer den Abstimmungslink weiter oeffnen, aber nicht mehr abstimmen oder aendern.
- Nach dem Schliessen koennen keine Terminvorschlaege mehr hinzugefuegt, geaendert oder geloescht werden.
- Nach dem Schliessen koennen Titel, Beschreibung, Dauer, PIN, Bearbeitungs-Zeitzone und Eingabebereich im MVP nicht mehr geaendert werden.
- Nach dem Schliessen kann der Veranstalter finale Termine markieren oder aendern.
- Finale Termine koennen erst nach dem Schliessen markiert werden.
- Finale Termine werden bei jeder Markierung oder Entfernung einer Markierung automatisch gespeichert.
- Es gibt keinen separaten Button `Finale Termine speichern`.
- Die Veranstalter-Auswertung zeigt nach dem Schliessen den Hinweis: `Select your final dates. Send a copy of the selection to participants including an .ics file.`
- Der Veranstalter kann eine beliebige Anzahl von Vorschlaegen als final markieren.
- `SetFinalProposals` darf eine leere Liste speichern.
- `SetFinalProposals` akzeptiert nur existierende Vorschlaege.
- Teilnehmer sehen finale Termine prominent.
- Nicht finale Vorschlaege koennen nach der finalen Auswahl ausgegraut angezeigt werden.
- Finale Termine haben visuell Vorrang vor der Zustimmungsstaerke.
- In der Veranstalter-Auswertung stehen finale Termine in einem eigenen Panel rechts neben dem Kalender.
- Finale Termine werden im Panel untereinander angezeigt.
- Die kopierbare Ergebnisliste enthaelt nur Meetingtitel und finale Termine, keine Teilnehmerdetails.
- Der Button zum Kopieren der Ergebnisliste wird als reiner Icon-Button dargestellt.
- Der Kopieren-Button verwendet das Lucide-Icon `Copy`.
- Der `.ics`-Download verwendet das Lucide-Icon `Download` plus den Text `.ics`.
- In der Veranstalter-Kopfzeile beim Meetingtitel gibt es keinen separaten `.ics`-Download.

## Kalenderexport

- Fuer finale Termine gibt es einen `.ics`-Download.
- Die `.ics`-Datei ist erst verfuegbar, wenn die Abstimmung geschlossen ist und finale Termine gesetzt sind.
- Die `.ics`-Datei enthaelt nur finale Termine.
- Jeder finale Vorschlag wird als eigener `VEVENT` erzeugt.
- Jeder `VEVENT` enthaelt Meeting-Titel, Beschreibung, Start und Ende.
- Start und Ende werden aus UTC-Zeitpunkt plus Dauer berechnet.
- Die `.ics`-Datei wird mit UTC-Zeiten erzeugt.
- Kalenderprogramme zeigen die Zeiten dadurch lokal korrekt an.
- Die `.ics`-Datei enthaelt keine Teilnehmerliste und keine Teilnehmerdetails.
- Die `.ics`-Datei ist in Teilnehmer- und Veranstalteransicht downloadbar.
- Der stabile Download-Endpunkt ist z. B. `/api/meetings/:meetingId/final.ics`.
- Der Dateiname des `.ics`-Downloads lautet `<Meetingtitel> - final dates.ics`.
- Der `.ics`-Endpunkt ist ohne PIN erreichbar, wenn man die Meeting-ID kennt.
- Vor dem Schliessen oder ohne finale Termine liefert der `.ics`-Endpunkt keinen Kalender, z. B. 404.
- Es gibt im MVP keine Vorschau der Ergebnisliste oder `.ics`-Datei vor dem Schliessen.

## UI-Fokus

- Es gibt im MVP keinen Dark Mode.
- Der visuelle Fokus liegt auf einem hellen, modernen Look.
- Die Modi `Vorschlagen` und `Auswerten` werden als kompakte View-Chips dargestellt, nicht als normale Aktionsbuttons.
- `Abstimmung schliessen` ist nur im Auswertungsmodus sichtbar.
- Das Details-Panel ist mit `Eckdaten` ueberschrieben.
- Der Eingabebereich fuer Kalendergrenzen heisst `Zeitrahmen`.
- Der Hinweis zum Anlegen und Entfernen von Terminvorschlaegen wird im Kalenderkopf als kurzer zweizeiliger Text angezeigt.
- Das Details-Klappicon steht rechts im Details-Kasten auf Hoehe der Kalender-Speicheraktion.
- Das Vorschlagsdetails-Overlay kann per Escape, X oder erneutem Klick auf den Vorschlagskopf geschlossen werden.
- Der Fokus liegt zuerst auf Desktop.
- Die Veranstalteransicht wird vor allem fuer Desktop und Tablet optimiert.
- Die Teilnehmeransicht soll grundlegend responsive und auch mobil bedienbar sein.
- Auf sehr kleinen Bildschirmen darf die Veranstalteransicht darauf hinweisen, dass Kalenderbearbeitung am Desktop besser funktioniert.
- Es gibt im MVP keine Impressums- oder Datenschutzseite.
- Es gibt im MVP keine Admin- oder Wartungsfunktionen zum Auflisten von Meetings.

## Veranstaltung Loeschen

- Der Veranstalter kann eine bereits gespeicherte Veranstaltung ueber den Bearbeitungslink loeschen.
- Loeschen ist erst sinnvoll und moeglich, wenn die Veranstaltung schon gespeichert wurde; der Loeschen-Button erscheint daher nur in der Veranstalteransicht.
- Der Loeschen-Button steht als Lucide-`Trash2`-Icon-Button rechts neben `Abstimmung schliessen`.
- Der Loeschen-Button bleibt auch nach dem Schliessen der Abstimmung sichtbar.
- Loeschen erfordert eine Bestaetigung in zwei Schritten: Ein erster Klick zeigt visuelles Feedback mit einem `?`, ein zweiter Klick loescht endgueltig.
- Bleibt der zweite Klick aus, faellt der Button nach kurzer Zeit in den Ausgangszustand zurueck.
- Beim Loeschen werden die Veranstaltung und alle zugehoerigen Votes entfernt.
- Das Loeschen erfolgt ueber `DELETE /api/meetings/:meetingId` mit `editId` im Body; ohne passende `editId` schlaegt es mit `Meeting not found` fehl.
- Nach dem Loeschen wird kurz ein Overlay `Veranstaltung "<Titel>" geloescht` angezeigt.
- Danach landet der Veranstalter auf einer leeren neuen Veranstaltung (`/`).
