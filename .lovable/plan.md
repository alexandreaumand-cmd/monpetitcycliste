
# Remplacer Gemini par du scraping HTML direct dans le Startlist Tracker

## Objectif

Supprimer les 2 appels Gemini du startlist-tracker (qui coutent des credits et sont parfois imprecis) et les remplacer par du parsing HTML regex, exactement comme dans `scrape-pcs-results`.

## Analyse de la structure HTML PCS

### Page "startlist changes" (`races.php?s=startlist-changes-all-races`)
- Table simple avec classe `basic`
- Chaque ligne `<tr>` contient : date, nom de course, classe, nombre de changements
- Lien de course dans format : `<a href="/race/{slug}/{year}/startlist">Race Name</a>`

### Page startlist d'une course (`/race/{slug}/{year}/startlist`)
- Structure `<ul class="startlist_v4">`
- Chaque `<li>` = une equipe, contenant :
  - `<a class="team" href="/team/...">Team Name (WT)</a>` pour le nom de l'equipe
  - `<a href="/rider/{slug}">LASTNAME Firstname</a>` pour chaque coureur

## Changements dans `supabase/functions/startlist-tracker/index.ts`

### 1. Nouvelle fonction `parseChangedRacesHtml(html)` (remplace `scrapeChangedRacesList`)
- Regex sur `<table class=" basic">` pour trouver la table
- Pour chaque `<tr>`, extraire le lien `/race/{slug}/{year}/startlist` et le nom de course
- Retourner un tableau `ChangedRace[]`
- Plus besoin de `lovableApiKey` ni d'appel Gemini

### 2. Nouvelle fonction `parseStartlistHtml(html)` (remplace la partie Gemini de `scrapeRaceStartlist`)
- Chercher `<ul class="startlist_v4">` ou `class="startlist_v4"`
- Pour chaque equipe : extraire le team name depuis `<a class="team">`
- Pour chaque coureur : extraire nom depuis `<a href="/rider/{slug}">LASTNAME Firstname</a>`
- Retourner la liste complete des coureurs avec leur equipe

### 3. Mise a jour de `scrapeChangedRacesList`
- Supprimer l'appel Gemini
- Appeler `parseChangedRacesHtml(html)` a la place
- Supprimer le parametre `apiKey`

### 4. Mise a jour de `scrapeRaceStartlist`
- Supprimer l'appel Gemini
- Appeler `parseStartlistHtml(html)` a la place
- Supprimer le parametre `apiKey`

### 5. Nettoyage general
- Supprimer `lovableApiKey` du code principal (plus utilise)
- Tout le reste (matching, processChanges, generateFullSyncChanges) reste identique

## Avantages
- Zero credit AI consomme par le tracker
- Parsing deterministe et instantane (pas de variation IA)
- Meme approche eprouvee que pour les resultats
- Plus de dependance a `LOVABLE_API_KEY` pour cette fonction
