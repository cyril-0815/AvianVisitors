/* ============================================================
   i18n - public collage UI in English, German and French.

   Scope: the public surfaces only (collage, stats, atlas, postcard,
   about). The admin overlays (settings / system / logs / tools) and the
   admin unlock form stay English by design, so nothing below covers
   them.

   Design notes
   ------------
   - English is the source language AND the fallback. A key missing from
     de/fr renders its English text, never an empty box.
   - Loaded before stamps.js and apt.js, so window.I18N exists by the
     time either of them renders anything.
   - Static markup carries data-i18n / data-i18n-attr / data-i18n-html
     attributes and is translated once on DOMContentLoaded. Anything
     rendered from JS calls I18N.t() at render time.
   - Species names are NOT translated here. They come from the API,
     which resolves them from the scientific name against BirdNET-Pi's
     own model/l18n/labels_<lang>.json. See avian/api/birdnet-api.php.
   ============================================================ */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'de', 'fr'];
  var STORAGE_KEY = 'bird:lang';
  // Swiss variants: the station lives in Switzerland and the whole
  // project is written in Swiss spelling (no eszett).
  var LOCALES = { en: 'en-US', de: 'de-CH', fr: 'fr-CH' };

  /* ---- Dictionaries ----
     EN is the contract. Every key here must exist in DE and FR; the
     test suite fails the build if one drifts. */
  var EN = {
    'meta.description': 'A live bird collage from your window.',

    'nav.view': 'View',
    'nav.collage': 'collage',
    'nav.stats': 'stats',
    'nav.atlas': 'atlas',
    'nav.menu': 'menu',
    'nav.backToCollage': 'back to collage',
    'nav.language': 'language',

    'title.heardRecently': 'Heard Recently',
    'title.avianAtlas': 'Avian Atlas',
    'empty.window': 'no detections heard in this window',

    'aria.birdCollage': 'Bird collage',
    'aria.stats': 'Stats',
    'aria.atlas': 'Atlas',

    'collage.call_one': 'call',
    'collage.call_other': 'calls',

    'window.thisHour': 'this hour',
    'window.past12h': 'past 12h',
    'window.today': 'today',
    'window.thisWeek': 'this week',
    'window.allTime': 'all time',
    'window.selectedHour': 'selected hour',
    'window.final12h': 'final 12h',
    'window.selectedDay': 'selected day',
    'window.selected7Days': 'selected 7 days',
    'window.throughSelectedDay': 'through selected day',

    'stats.byPeriod': 'By Period',
    'stats.byPeriodCap': 'detections, grouped by recency',
    'stats.byPeriodCapPast': 'detections through {date}',
    'stats.topSpecies': 'Top Species',
    'stats.topSpeciesCap': 'most-heard, {window}',
    'stats.firstDetections': 'First Detections',
    'stats.firstDetectionsCap': 'newest additions to the life list',
    'stats.firstDetectionsCapPast': 'life list as of {date}',
    'stats.mostHeardOf': '{n} most-heard of {total}',
    'stats.noDetectionsYet': 'no detections yet',
    'stats.thatDay': 'that day',
    'stats.today': 'today',
    'stats.daysAgo': '{n}d ago',
    'stats.daysPrior': '{n}d prior',

    'stats.row.now': 'NOW',
    'stats.row.hour': 'HOUR',
    'stats.row.lastHour': 'last hour',
    'stats.row.finalHour': 'final hour',
    'stats.row.today': 'TODAY',
    'stats.row.day': 'DAY',
    'stats.row.todayLabel': 'today',
    'stats.row.selectedDate': 'selected date',
    'stats.row.week': '7D',
    'stats.row.last7days': 'last 7 days',
    'stats.row.throughThisDate': 'through this date',
    'stats.row.all': 'ALL',
    'stats.row.allTime': 'all time',

    'rhythm.week': "Week's Rhythm",
    'rhythm.weekCap': 'average day in this 7-day window, over the previous 7 days',
    'rhythm.hour': "Hour's Rhythm",
    'rhythm.hourCap': "detections through the selected hour, over the prior week's average",
    'rhythm.today': "Today's Rhythm",
    'rhythm.today12hCap': "detections through the current 12-hour window, over last week's average",
    'rhythm.todayCap': "detections through the day, over last week's average",
    'rhythm.day': "Day's Rhythm",
    'rhythm.dayCap': "detections on the selected date, over the prior week's average",

    'cal.statsDate': 'Stats date',
    'cal.today': 'today',
    'cal.latestHeard': 'latest heard',
    'cal.chooseDate': 'Choose stats date',
    'cal.chooseDateWith': 'Choose stats date, {date}',
    'cal.prevDay': 'Previous day',
    'cal.nextDay': 'Next day',
    'cal.prevMonth': 'Previous month',
    'cal.nextMonth': 'Next month',
    'cal.detections_one': '{n} detection',
    'cal.detections_other': '{n} detections',
    'cal.noDetections': 'no detections',
    'cal.weekdays': 'S,M,T,W,T,F,S',

    'chart.aria': 'chart',
    'chart.timeline': 'timeline',
    'chart.detectionTimeline': 'detection timeline',
    'chart.byHour': 'by hour',
    'heatmap.showMore': 'Show more',
    'heatmap.showLess': 'Show less',

    'atlas.sort': 'sort atlas',
    'atlas.lifeList': 'life list',
    'atlas.byFamily': 'by family',
    'atlas.alphabetical': 'alphabetical',
    'atlas.az': 'a → z',
    'atlas.mostHeard': 'most heard',
    'atlas.speciesCount_one': '{n} species',
    'atlas.speciesCount_other': '{n} species',
    'atlas.emptyTitle': 'No birds detected yet.',
    'atlas.emptyHint': 'The atlas fills up as BirdNET-Pi identifies new species.',

    'pc.close': 'close',
    'pc.dragClose': 'Drag down or press to close postcard',
    'pc.illustration': 'Bird illustration',
    'pc.pose': 'Pose',
    'pc.perched': 'perched',
    'pc.inFlight': 'in flight',
    'pc.generate': 'generate image',
    'pc.unlockToGenerate': 'unlock in menu to generate',
    'pc.unlockToCheck': 'unlock in menu to check progress',
    'pc.genFailed': 'failed, try again',
    'pc.genNoKey': 'add a gemini key in settings',
    'pc.refs': 'External bird references',
    'pc.history': 'Bird history',
    'pc.heard': 'heard',
    'pc.firstHeard': 'first heard',
    'pc.selectedStamp': 'selected stamp',
    'pc.about': 'About',
    'pc.loadingDesc': 'Loading description...',
    'pc.noDesc': 'No description available.',
    'pc.family': 'Family',
    'pc.genus': 'Genus',
    'pc.species': 'Species',
    'pc.rarity': 'Rarity',
    'pc.recordings': 'Recordings',
    'pc.recCount_one': '{n} recording',
    'pc.recCount_other': '{n} recordings',
    'pc.lastHeard': 'Last heard',
    'pc.confidence': 'Confidence',
    'pc.dateTime': 'Date & time',
    'pc.loadingRecs': 'Loading recordings...',
    'pc.noRecs': 'No recordings yet.',
    'pc.recsFailed': 'Failed to load recordings.',
    'pc.loadingSpectro': 'loading spectrogram...',
    'pc.play': 'Play recording',
    'pc.pause': 'Pause recording',
    'pc.loop': 'loop',
    'pc.loopOn': 'Repeat a selected section',
    'pc.loopOff': 'Stop repeating selected section',
    'pc.scrub': 'Scrub recording spectrogram',
    'pc.loopStart': 'Repeat section start',
    'pc.loopEnd': 'Repeat section end',
    'pc.ofDuration': '{pos} of {total}',
    'pc.percent': '{n} percent',
    'pc.altNotGenerated': 'Nest with eggs, bird image not generated yet for {sci}',
    'pc.altUnavailable': 'Nest with eggs, bird illustration temporarily unavailable for {sci}',

    'rarity.common': 'common',
    'rarity.regular': 'regular',
    'rarity.occasional': 'occasional',
    'rarity.rare': 'rare',

    'ago.seconds': '{n}s ago',
    'ago.minutes': '{n}m ago',
    'ago.hours': '{n}h ago',
    'ago.days': '{n}d ago',

    'about.title': 'The birds outside your window',
    'about.body': 'A tiny microphone identifies every passing bird with Cornell\'s <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>. Each species shows up as an illustration in the collage, sized by how often it\'s been heard.',
    'about.explore': 'explore the birds →',

    /* Stamp/atlas family groups. The English string doubles as the
       lookup key everywhere in the code, so only the label travels. */
    'family.Sparrows': 'Sparrows',
    'family.Finches': 'Finches',
    'family.Thrushes': 'Thrushes',
    'family.Doves & Pigeons': 'Doves & Pigeons',
    'family.Crows & Jays': 'Crows & Jays',
    'family.Chickadees & Titmice': 'Chickadees & Titmice',
    'family.Blackbirds & Orioles': 'Blackbirds & Orioles',
    'family.Mockingbirds & Thrashers': 'Mockingbirds & Thrashers',
    'family.Warblers & Vireos': 'Warblers & Vireos',
    'family.Waterfowl': 'Waterfowl',
    'family.Waxwings': 'Waxwings',
    'family.Gulls': 'Gulls',
    'family.Hawks': 'Hawks',
    'family.Herons': 'Herons',
    'family.Hummingbirds': 'Hummingbirds',
    'family.Owls': 'Owls',
    'family.Flycatchers': 'Flycatchers',
    'family.Kingfishers': 'Kingfishers',
    'family.Shorebirds': 'Shorebirds',
    'family.Swallows': 'Swallows',
    'family.Treecreepers': 'Treecreepers',
    'family.Other': 'Other'
  };

  var DE = {
    'meta.description': 'Eine live aktualisierte Vogel-Collage vor deinem Fenster.',

    'nav.view': 'Ansicht',
    'nav.collage': 'collage',
    'nav.stats': 'statistik',
    'nav.atlas': 'atlas',
    'nav.menu': 'menü',
    'nav.backToCollage': 'zurück zur Collage',
    'nav.language': 'Sprache',

    'title.heardRecently': 'Kürzlich gehört',
    'title.avianAtlas': 'Vogel-Atlas',
    'empty.window': 'keine Erkennungen in diesem Zeitraum',

    'aria.birdCollage': 'Vogel-Collage',
    'aria.stats': 'Statistik',
    'aria.atlas': 'Atlas',

    'collage.call_one': 'Ruf',
    'collage.call_other': 'Rufe',

    'window.thisHour': 'in dieser Stunde',
    'window.past12h': 'in den letzten 12 Std.',
    'window.today': 'heute',
    'window.thisWeek': 'diese Woche',
    'window.allTime': 'insgesamt',
    'window.selectedHour': 'in der gewählten Stunde',
    'window.final12h': 'in den letzten 12 Std.',
    'window.selectedDay': 'am gewählten Tag',
    'window.selected7Days': 'in den gewählten 7 Tagen',
    'window.throughSelectedDay': 'bis zum gewählten Tag',

    'stats.byPeriod': 'Nach Zeitraum',
    'stats.byPeriodCap': 'Erkennungen, nach Aktualität gruppiert',
    'stats.byPeriodCapPast': 'Erkennungen bis {date}',
    'stats.topSpecies': 'Häufigste Arten',
    'stats.topSpeciesCap': 'am häufigsten gehört, {window}',
    'stats.firstDetections': 'Erstnachweise',
    'stats.firstDetectionsCap': 'neueste Einträge in der Lebensliste',
    'stats.firstDetectionsCapPast': 'Lebensliste per {date}',
    'stats.mostHeardOf': '{n} häufigste von {total}',
    'stats.noDetectionsYet': 'noch keine Erkennungen',
    'stats.thatDay': 'an dem Tag',
    'stats.today': 'heute',
    'stats.daysAgo': 'vor {n} T',
    'stats.daysPrior': '{n} T davor',

    'stats.row.now': 'JETZT',
    'stats.row.hour': 'STUNDE',
    'stats.row.lastHour': 'letzte Stunde',
    'stats.row.finalHour': 'letzte Stunde',
    'stats.row.today': 'HEUTE',
    'stats.row.day': 'TAG',
    'stats.row.todayLabel': 'heute',
    'stats.row.selectedDate': 'gewähltes Datum',
    'stats.row.week': '7T',
    'stats.row.last7days': 'letzte 7 Tage',
    'stats.row.throughThisDate': 'bis zu diesem Datum',
    'stats.row.all': 'ALLE',
    'stats.row.allTime': 'insgesamt',

    'rhythm.week': 'Wochenrhythmus',
    'rhythm.weekCap': 'durchschnittlicher Tag in diesen 7 Tagen, über den 7 Tagen davor',
    'rhythm.hour': 'Stundenrhythmus',
    'rhythm.hourCap': 'Erkennungen in der gewählten Stunde, über dem Durchschnitt der Vorwoche',
    'rhythm.today': 'Tagesrhythmus',
    'rhythm.today12hCap': 'Erkennungen im laufenden 12-Stunden-Fenster, über dem Durchschnitt der Vorwoche',
    'rhythm.todayCap': 'Erkennungen über den Tag, über dem Durchschnitt der Vorwoche',
    'rhythm.day': 'Tagesrhythmus',
    'rhythm.dayCap': 'Erkennungen am gewählten Datum, über dem Durchschnitt der Vorwoche',

    'cal.statsDate': 'Statistik-Datum',
    'cal.today': 'heute',
    'cal.latestHeard': 'zuletzt gehört',
    'cal.chooseDate': 'Datum für die Statistik wählen',
    'cal.chooseDateWith': 'Datum für die Statistik wählen, {date}',
    'cal.prevDay': 'Vorheriger Tag',
    'cal.nextDay': 'Nächster Tag',
    'cal.prevMonth': 'Vorheriger Monat',
    'cal.nextMonth': 'Nächster Monat',
    'cal.detections_one': '{n} Erkennung',
    'cal.detections_other': '{n} Erkennungen',
    'cal.noDetections': 'keine Erkennungen',
    'cal.weekdays': 'S,M,D,M,D,F,S',

    'chart.aria': 'Diagramm',
    'chart.timeline': 'Zeitverlauf',
    'chart.detectionTimeline': 'Zeitverlauf der Erkennungen',
    'chart.byHour': 'nach Stunde',
    'heatmap.showMore': 'Mehr anzeigen',
    'heatmap.showLess': 'Weniger anzeigen',

    'atlas.sort': 'Atlas sortieren',
    'atlas.lifeList': 'Lebensliste',
    'atlas.byFamily': 'nach Familie',
    'atlas.alphabetical': 'alphabetisch',
    'atlas.az': 'a → z',
    'atlas.mostHeard': 'am meisten gehört',
    'atlas.speciesCount_one': '{n} Art',
    'atlas.speciesCount_other': '{n} Arten',
    'atlas.emptyTitle': 'Noch keine Vögel erkannt.',
    'atlas.emptyHint': 'Der Atlas füllt sich, sobald BirdNET-Pi neue Arten erkennt.',

    'pc.close': 'schliessen',
    'pc.dragClose': 'Nach unten ziehen oder drücken, um die Karte zu schliessen',
    'pc.illustration': 'Vogel-Illustration',
    'pc.pose': 'Haltung',
    'pc.perched': 'sitzend',
    'pc.inFlight': 'im Flug',
    'pc.generate': 'Bild erzeugen',
    'pc.unlockToGenerate': 'zum Erzeugen im Menü entsperren',
    'pc.unlockToCheck': 'für den Fortschritt im Menü entsperren',
    'pc.genFailed': 'fehlgeschlagen, nochmals versuchen',
    'pc.genNoKey': 'Gemini-Key in den Einstellungen hinterlegen',
    'pc.refs': 'Externe Quellen zur Art',
    'pc.history': 'Verlauf der Art',
    'pc.heard': 'gehört',
    'pc.firstHeard': 'erstmals gehört',
    'pc.selectedStamp': 'gewählte Marke',
    'pc.about': 'Über die Art',
    'pc.loadingDesc': 'Beschreibung wird geladen...',
    'pc.noDesc': 'Keine Beschreibung verfügbar.',
    'pc.family': 'Familie',
    'pc.genus': 'Gattung',
    'pc.species': 'Art',
    'pc.rarity': 'Häufigkeit',
    'pc.recordings': 'Aufnahmen',
    'pc.recCount_one': '{n} Aufnahme',
    'pc.recCount_other': '{n} Aufnahmen',
    'pc.lastHeard': 'Zuletzt gehört',
    'pc.confidence': 'Konfidenz',
    'pc.dateTime': 'Datum & Zeit',
    'pc.loadingRecs': 'Aufnahmen werden geladen...',
    'pc.noRecs': 'Noch keine Aufnahmen.',
    'pc.recsFailed': 'Aufnahmen konnten nicht geladen werden.',
    'pc.loadingSpectro': 'Spektrogramm wird geladen...',
    'pc.play': 'Aufnahme abspielen',
    'pc.pause': 'Aufnahme pausieren',
    'pc.loop': 'Schleife',
    'pc.loopOn': 'Ausschnitt wiederholen',
    'pc.loopOff': 'Wiederholung beenden',
    'pc.scrub': 'Im Spektrogramm navigieren',
    'pc.loopStart': 'Beginn der Wiederholung',
    'pc.loopEnd': 'Ende der Wiederholung',
    'pc.ofDuration': '{pos} von {total}',
    'pc.percent': '{n} Prozent',
    'pc.altNotGenerated': 'Nest mit Eiern, für {sci} wurde noch kein Bild erzeugt',
    'pc.altUnavailable': 'Nest mit Eiern, Illustration für {sci} vorübergehend nicht verfügbar',

    'rarity.common': 'häufig',
    'rarity.regular': 'regelmässig',
    'rarity.occasional': 'gelegentlich',
    'rarity.rare': 'selten',

    'ago.seconds': 'vor {n} s',
    'ago.minutes': 'vor {n} min',
    'ago.hours': 'vor {n} Std.',
    'ago.days': 'vor {n} T',

    'about.title': 'Die Vögel vor deinem Fenster',
    'about.body': 'Ein kleines Mikrofon bestimmt jeden vorbeikommenden Vogel mit <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> von Cornell. Jede Art erscheint als Illustration in der Collage, in der Grösse danach, wie oft sie gehört wurde.',
    'about.explore': 'zu den Vögeln →',

    'family.Sparrows': 'Sperlinge',
    'family.Finches': 'Finken',
    'family.Thrushes': 'Drosseln',
    'family.Doves & Pigeons': 'Tauben',
    'family.Crows & Jays': 'Rabenvögel',
    'family.Chickadees & Titmice': 'Meisen',
    'family.Blackbirds & Orioles': 'Stärlinge',
    'family.Mockingbirds & Thrashers': 'Spottdrosseln',
    'family.Warblers & Vireos': 'Waldsänger & Vireos',
    'family.Waterfowl': 'Wasservögel',
    'family.Waxwings': 'Seidenschwänze',
    'family.Gulls': 'Möwen',
    'family.Hawks': 'Greifvögel',
    'family.Herons': 'Reiher',
    'family.Hummingbirds': 'Kolibris',
    'family.Owls': 'Eulen',
    'family.Flycatchers': 'Tyrannen',
    'family.Kingfishers': 'Eisvögel',
    'family.Shorebirds': 'Watvögel',
    'family.Swallows': 'Schwalben',
    'family.Treecreepers': 'Baumläufer',
    'family.Other': 'Andere'
  };

  var FR = {
    'meta.description': 'Un collage d\'oiseaux en direct depuis votre fenêtre.',

    'nav.view': 'Vue',
    'nav.collage': 'collage',
    'nav.stats': 'stats',
    'nav.atlas': 'atlas',
    'nav.menu': 'menu',
    'nav.backToCollage': 'retour au collage',
    'nav.language': 'langue',

    'title.heardRecently': 'Entendus récemment',
    'title.avianAtlas': 'Atlas des oiseaux',
    'empty.window': 'aucune détection sur cette période',

    'aria.birdCollage': 'Collage d\'oiseaux',
    'aria.stats': 'Statistiques',
    'aria.atlas': 'Atlas',

    'collage.call_one': 'cri',
    'collage.call_other': 'cris',

    'window.thisHour': 'cette heure',
    'window.past12h': 'ces 12 dernières heures',
    'window.today': 'aujourd\'hui',
    'window.thisWeek': 'cette semaine',
    'window.allTime': 'au total',
    'window.selectedHour': 'sur l\'heure choisie',
    'window.final12h': 'ces 12 dernières heures',
    'window.selectedDay': 'sur le jour choisi',
    'window.selected7Days': 'sur les 7 jours choisis',
    'window.throughSelectedDay': 'jusqu\'au jour choisi',

    'stats.byPeriod': 'Par période',
    'stats.byPeriodCap': 'détections, groupées par récence',
    'stats.byPeriodCapPast': 'détections jusqu\'au {date}',
    'stats.topSpecies': 'Espèces les plus entendues',
    'stats.topSpeciesCap': 'les plus entendues, {window}',
    'stats.firstDetections': 'Premières détections',
    'stats.firstDetectionsCap': 'derniers ajouts à la liste de vie',
    'stats.firstDetectionsCapPast': 'liste de vie au {date}',
    'stats.mostHeardOf': '{n} plus entendues sur {total}',
    'stats.noDetectionsYet': 'aucune détection pour l\'instant',
    'stats.thatDay': 'ce jour-là',
    'stats.today': 'aujourd\'hui',
    'stats.daysAgo': 'il y a {n} j',
    'stats.daysPrior': '{n} j avant',

    'stats.row.now': 'MAINT.',
    'stats.row.hour': 'HEURE',
    'stats.row.lastHour': 'dernière heure',
    'stats.row.finalHour': 'dernière heure',
    'stats.row.today': 'AUJ.',
    'stats.row.day': 'JOUR',
    'stats.row.todayLabel': 'aujourd\'hui',
    'stats.row.selectedDate': 'date choisie',
    'stats.row.week': '7J',
    'stats.row.last7days': '7 derniers jours',
    'stats.row.throughThisDate': 'jusqu\'à cette date',
    'stats.row.all': 'TOUT',
    'stats.row.allTime': 'au total',

    'rhythm.week': 'Rythme de la semaine',
    'rhythm.weekCap': 'journée moyenne sur ces 7 jours, comparée aux 7 jours précédents',
    'rhythm.hour': 'Rythme de l\'heure',
    'rhythm.hourCap': 'détections sur l\'heure choisie, comparées à la moyenne de la semaine précédente',
    'rhythm.today': 'Rythme du jour',
    'rhythm.today12hCap': 'détections sur la fenêtre de 12 heures en cours, comparées à la moyenne de la semaine précédente',
    'rhythm.todayCap': 'détections au fil de la journée, comparées à la moyenne de la semaine précédente',
    'rhythm.day': 'Rythme du jour',
    'rhythm.dayCap': 'détections à la date choisie, comparées à la moyenne de la semaine précédente',

    'cal.statsDate': 'Date des statistiques',
    'cal.today': 'aujourd\'hui',
    'cal.latestHeard': 'dernière écoute',
    'cal.chooseDate': 'Choisir la date des statistiques',
    'cal.chooseDateWith': 'Choisir la date des statistiques, {date}',
    'cal.prevDay': 'Jour précédent',
    'cal.nextDay': 'Jour suivant',
    'cal.prevMonth': 'Mois précédent',
    'cal.nextMonth': 'Mois suivant',
    'cal.detections_one': '{n} détection',
    'cal.detections_other': '{n} détections',
    'cal.noDetections': 'aucune détection',
    'cal.weekdays': 'D,L,M,M,J,V,S',

    'chart.aria': 'graphique',
    'chart.timeline': 'chronologie',
    'chart.detectionTimeline': 'chronologie des détections',
    'chart.byHour': 'par heure',
    'heatmap.showMore': 'Afficher plus',
    'heatmap.showLess': 'Afficher moins',

    'atlas.sort': 'trier l\'atlas',
    'atlas.lifeList': 'liste de vie',
    'atlas.byFamily': 'par famille',
    'atlas.alphabetical': 'alphabétique',
    'atlas.az': 'a → z',
    'atlas.mostHeard': 'les plus entendus',
    'atlas.speciesCount_one': '{n} espèce',
    'atlas.speciesCount_other': '{n} espèces',
    'atlas.emptyTitle': 'Aucun oiseau détecté pour l\'instant.',
    'atlas.emptyHint': 'L\'atlas se remplit à mesure que BirdNET-Pi identifie de nouvelles espèces.',

    'pc.close': 'fermer',
    'pc.dragClose': 'Faire glisser vers le bas ou appuyer pour fermer la carte',
    'pc.illustration': 'Illustration d\'oiseau',
    'pc.pose': 'Pose',
    'pc.perched': 'perché',
    'pc.inFlight': 'en vol',
    'pc.generate': 'générer l\'image',
    'pc.unlockToGenerate': 'déverrouiller dans le menu pour générer',
    'pc.unlockToCheck': 'déverrouiller dans le menu pour suivre',
    'pc.genFailed': 'échec, réessayer',
    'pc.genNoKey': 'ajouter une clé Gemini dans les réglages',
    'pc.refs': 'Références externes',
    'pc.history': 'Historique de l\'espèce',
    'pc.heard': 'entendu',
    'pc.firstHeard': 'première écoute',
    'pc.selectedStamp': 'timbre sélectionné',
    'pc.about': 'À propos',
    'pc.loadingDesc': 'Chargement de la description...',
    'pc.noDesc': 'Aucune description disponible.',
    'pc.family': 'Famille',
    'pc.genus': 'Genre',
    'pc.species': 'Espèce',
    'pc.rarity': 'Fréquence',
    'pc.recordings': 'Enregistrements',
    'pc.recCount_one': '{n} enregistrement',
    'pc.recCount_other': '{n} enregistrements',
    'pc.lastHeard': 'Dernière écoute',
    'pc.confidence': 'Confiance',
    'pc.dateTime': 'Date et heure',
    'pc.loadingRecs': 'Chargement des enregistrements...',
    'pc.noRecs': 'Aucun enregistrement pour l\'instant.',
    'pc.recsFailed': 'Échec du chargement des enregistrements.',
    'pc.loadingSpectro': 'chargement du spectrogramme...',
    'pc.play': 'Lire l\'enregistrement',
    'pc.pause': 'Mettre l\'enregistrement en pause',
    'pc.loop': 'boucle',
    'pc.loopOn': 'Répéter une section',
    'pc.loopOff': 'Arrêter la répétition',
    'pc.scrub': 'Naviguer dans le spectrogramme',
    'pc.loopStart': 'Début de la section répétée',
    'pc.loopEnd': 'Fin de la section répétée',
    'pc.ofDuration': '{pos} sur {total}',
    'pc.percent': '{n} pour cent',
    'pc.altNotGenerated': 'Nid avec des oeufs, aucune image encore générée pour {sci}',
    'pc.altUnavailable': 'Nid avec des oeufs, illustration momentanément indisponible pour {sci}',

    'rarity.common': 'commun',
    'rarity.regular': 'régulier',
    'rarity.occasional': 'occasionnel',
    'rarity.rare': 'rare',

    'ago.seconds': 'il y a {n} s',
    'ago.minutes': 'il y a {n} min',
    'ago.hours': 'il y a {n} h',
    'ago.days': 'il y a {n} j',

    'about.title': 'Les oiseaux devant votre fenêtre',
    'about.body': 'Un petit micro identifie chaque oiseau de passage avec <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> de Cornell. Chaque espèce apparaît comme une illustration dans le collage, dimensionnée selon la fréquence à laquelle elle a été entendue.',
    'about.explore': 'découvrir les oiseaux →',

    'family.Sparrows': 'Moineaux',
    'family.Finches': 'Fringilles',
    'family.Thrushes': 'Grives',
    'family.Doves & Pigeons': 'Colombidés',
    'family.Crows & Jays': 'Corvidés',
    'family.Chickadees & Titmice': 'Mésanges',
    'family.Blackbirds & Orioles': 'Ictéridés',
    'family.Mockingbirds & Thrashers': 'Moqueurs',
    'family.Warblers & Vireos': 'Parulines et viréos',
    'family.Waterfowl': 'Sauvagine',
    'family.Waxwings': 'Jaseurs',
    'family.Gulls': 'Goélands',
    'family.Hawks': 'Rapaces',
    'family.Herons': 'Hérons',
    'family.Hummingbirds': 'Colibris',
    'family.Owls': 'Hiboux',
    'family.Flycatchers': 'Tyrans',
    'family.Kingfishers': 'Martins-pêcheurs',
    'family.Shorebirds': 'Limicoles',
    'family.Swallows': 'Hirondelles',
    'family.Treecreepers': 'Grimpereaux',
    'family.Other': 'Autres'
  };

  var DICTS = { en: EN, de: DE, fr: FR };

  /* ---- Language resolution ----
     URL parameter wins (that is how the kiosk screen pins a language),
     then the saved choice, then the browser, then English. */
  function fromQuery() {
    try {
      var match = /[?&]lang=([A-Za-z_-]+)/.exec(String(location.search || ''));
      if (!match) return '';
      var value = match[1].toLowerCase().slice(0, 2);
      return SUPPORTED.indexOf(value) >= 0 ? value : '';
    } catch (e) { return ''; }
  }
  function fromStorage() {
    try {
      var value = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      return SUPPORTED.indexOf(value) >= 0 ? value : '';
    } catch (e) { return ''; }
  }
  function fromBrowser() {
    try {
      var list = navigator.languages && navigator.languages.length
        ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < list.length; i++) {
        var value = String(list[i] || '').toLowerCase().slice(0, 2);
        if (SUPPORTED.indexOf(value) >= 0) return value;
      }
    } catch (e) {}
    return '';
  }
  function resolve() {
    return fromQuery() || fromStorage() || fromBrowser() || 'en';
  }

  var pinned = fromQuery();
  var lang = resolve();

  function fill(template, vars) {
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
    });
  }

  /* Missing key -> English -> the key itself. A missing translation
     must never render as an empty box. */
  function t(key, vars) {
    var dict = DICTS[lang] || EN;
    var value = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
    if (value === undefined) {
      value = Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key;
    }
    return fill(value, vars);
  }

  /* English has one plural break and so do German and French; the
     suffix convention keeps both dictionaries honest. */
  function plural(key, n, vars) {
    var merged = { n: n };
    if (vars) for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) merged[k] = vars[k];
    return t(key + (Math.abs(+n) === 1 ? '_one' : '_other'), merged);
  }

  function familyLabel(englishName) {
    if (!englishName) return t('family.Other');
    return t('family.' + englishName);
  }

  function localeTag() { return LOCALES[lang] || LOCALES.en; }

  function formatNumber(n) {
    try { return Number(n).toLocaleString(localeTag()); } catch (e) { return String(n); }
  }
  function formatDate(date, options) {
    try { return date.toLocaleDateString(localeTag(), options); } catch (e) { return String(date); }
  }

  function weekdayLetters() {
    return t('cal.weekdays').split(',');
  }

  /* ---- Static markup ----
     data-i18n            -> textContent
     data-i18n-html       -> innerHTML (only for our own strings with markup)
     data-i18n-attr       -> "aria-label:key;title:other.key" */
  function applyDom(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      String(el.getAttribute('data-i18n-attr') || '').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length !== 2) return;
        var attr = bits[0].trim(), key = bits[1].trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    if (scope === document) {
      document.documentElement.setAttribute('lang', lang);
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', t('meta.description'));
    }
  }

  /* Switching language re-resolves every rendered surface at once. A
     reload is the honest way to do that: the collage, the atlas grid,
     the stamps and every API payload all carry language now, and
     re-deriving them in place would mean a second rendering path to
     keep correct forever. The kiosk screen never takes this path. */
  function setLang(next) {
    if (SUPPORTED.indexOf(next) < 0 || next === lang) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    // Keep the in-memory language in step with what was just stored, so a
    // second press of the same button is a no-op even in the moment
    // before the reload takes effect.
    lang = next;
    window.I18N.lang = next;
    location.reload();
  }

  window.I18N = {
    SUPPORTED: SUPPORTED,
    STORAGE_KEY: STORAGE_KEY,
    DICTS: DICTS,
    lang: lang,
    pinned: !!pinned,
    t: t,
    plural: plural,
    familyLabel: familyLabel,
    locale: localeTag,
    formatNumber: formatNumber,
    formatDate: formatDate,
    weekdayLetters: weekdayLetters,
    applyDom: applyDom,
    setLang: setLang,
    resolve: resolve
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyDom(document); });
  } else {
    applyDom(document);
  }
})();
