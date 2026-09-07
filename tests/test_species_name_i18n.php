<?php
declare(strict_types=1);

/* Species names in the visitor's language.

   birds.db stores Com_Name in whatever DATABASE_LANG was configured when
   a bird was heard. The API resolves the display name from Sci_Name at
   read time instead, so the collage can be German while the rows on disk
   say "Eurasian Blackbird". These tests cover that resolution, the
   payload shapes it has to walk, and the path handling that keeps a
   ?lang= parameter from reaching anything but a label table. */

define('AVIAN_BIRDNET_API_LIBRARY_ONLY', true);
require dirname(__DIR__) . '/avian/api/birdnet-api.php';

$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    $checks++;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$labelDir = dirname(__DIR__) . '/model/l18n';

/* ---- the label tables this feature depends on are actually shipped ---- */
foreach (['en', 'de', 'fr'] as $lang) {
    check(is_readable($labelDir . "/labels_{$lang}.json"), "labels_{$lang}.json ships with the model");
    check(avianLabelPath($lang) !== '', "avianLabelPath resolves {$lang}");
}

/* ---- path handling: ?lang= must never address anything else ---- */
$rejected = ['', '..', '../de', 'de/../../etc/passwd', '/etc/passwd', 'de.json',
             'deu', 'd', 'en;rm', "de\0", 'zz'];
foreach ($rejected as $bad) {
    check(avianLabelPath($bad) === '', 'avianLabelPath rejects ' . var_export($bad, true));
}
check(avianLabelPath('DE') !== '', 'a mixed-case tag still resolves');

/* ---- a single lookup against the real tables ---- */
$de = file_get_contents($labelDir . '/labels_de.json');
$fr = file_get_contents($labelDir . '/labels_fr.json');
check(avianLookupName($de, 'Turdus merula') === 'Amsel', 'German name for Turdus merula');
check(avianLookupName($fr, 'Turdus merula') === 'Merle noir', 'French name for Turdus merula');
check(avianLookupName($de, 'Parus major') === 'Kohlmeise', 'German name for Parus major');
check(avianLookupName($de, 'Sitta europaea') === 'Kleiber', 'German name for Sitta europaea');
check(avianLookupName($de, 'Not aspecies') === '', 'an unknown species resolves to nothing');
check(avianLookupName($de, '') === '', 'an empty scientific name resolves to nothing');
/* Regex metacharacters in a name must be matched literally, not compiled. */
check(avianLookupName($de, 'Turdus.merula') === '', 'the lookup does not treat the name as a pattern');

$names = avianSpeciesNames(['Turdus merula', 'Parus major', 'Not aspecies'], 'de');
check($names === ['Turdus merula' => 'Amsel', 'Parus major' => 'Kohlmeise'],
    'a batch lookup returns only what it found');
check(avianSpeciesNames(['Turdus merula'], '') === [], 'no language means no lookup');
check(avianSpeciesNames([], 'de') === [], 'no species means no lookup');

/* ---- payload walking: the two shapes the endpoints produce ---- */
$rowPayload = [
    'species' => [
        ['sci' => 'Turdus merula', 'com' => 'Eurasian Blackbird', 'n' => 12],
        ['sci' => 'Parus major', 'com' => 'Great Tit', 'n' => 3],
        ['sci' => 'Not aspecies', 'com' => 'Stored Name', 'n' => 1],
    ],
    'as_of' => '2026-09-05T12:00:00+02:00',
];
$translated = avianTranslatePayload($rowPayload, 'de');
check($translated['species'][0]['com'] === 'Amsel', 'row names are translated');
check($translated['species'][1]['com'] === 'Kohlmeise', 'every row is translated');
check($translated['species'][2]['com'] === 'Stored Name',
    'an unknown species keeps the name stored in the database');
check($translated['species'][0]['sci'] === 'Turdus merula', 'the scientific name is left alone');
check($translated['species'][0]['n'] === 12, 'the counts are left alone');
check($translated['as_of'] === $rowPayload['as_of'], 'unrelated fields are left alone');

/* The species page carries sci at the top and com one level down. */
$speciesPayload = [
    'sci' => 'Turdus merula',
    'summary' => ['com' => 'Eurasian Blackbird', 'total' => 40],
    'detections' => [['d' => '2026-09-05', 't' => '07:12:00', 'conf' => 0.91]],
];
$fr_payload = avianTranslatePayload($speciesPayload, 'fr');
check($fr_payload['summary']['com'] === 'Merle noir', 'the species page summary is translated');
check($fr_payload['detections'][0]['conf'] === 0.91, 'detection rows are untouched');

/* The hourly ledger nests per-hour rows under each species. */
$hourlyPayload = ['species' => [[
    'sci' => 'Parus major', 'com' => 'Great Tit', 'total' => 5,
    'hours' => [['hour' => 6, 'n' => 2], ['hour' => 7, 'n' => 3]],
]]];
$nested = avianTranslatePayload($hourlyPayload, 'de');
check($nested['species'][0]['com'] === 'Kohlmeise', 'nested payloads are translated');
check($nested['species'][0]['hours'][1]['n'] === 3, 'nested rows keep their numbers');

/* ---- English is a translation too ----
   If the station recorded under DATABASE_LANG=de, asking for English has
   to resolve back out of German, not just pass the stored name through. */
$germanRows = ['species' => [['sci' => 'Turdus merula', 'com' => 'Amsel']]];
check(avianTranslatePayload($germanRows, 'en')['species'][0]['com'] === 'Eurasian Blackbird',
    'English resolves out of a German database');

/* ---- no language, no change ---- */
check(avianTranslatePayload($rowPayload, '') === $rowPayload, 'without a language the payload is untouched');
$noSpecies = ['totals' => ['detections' => 4, 'species' => 2]];
check(avianTranslatePayload($noSpecies, 'de') === $noSpecies, 'a payload without species is untouched');

/* ---- every data endpoint goes through the single exit ---- */
$source = file_get_contents(dirname(__DIR__) . '/avian/api/birdnet-api.php');
preg_match_all('/echo json_encode\(([^\n]*)/', $source, $matches);
foreach ($matches[1] as $tail) {
    check(strpos($tail, "'error'") !== false || strpos($tail, 'avianTranslatePayload') !== false,
        'a data payload bypasses avian_json(): echo json_encode(' . substr($tail, 0, 40));
}
check(substr_count($source, 'avian_json([') >= 8, 'the data endpoints route through avian_json()');

echo "species name i18n tests passed ({$checks} checks)\n";
