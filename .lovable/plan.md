## Diagnostic

Le compte à rebours affiché sur la carte « ENCHÈRES PROGRAMMÉES » ne lit **pas** le champ `leagues.first_auction_starts_at` de la ligue. Il lit `auctions.opens_at` du round 1 (cf. `src/hooks/useLeagueAuctionStatus.tsx` l.140–169, qui sélectionne la première enchère `statut='scheduled'` triée par `opens_at`).

Pour la ligue **RMC <> La Bordure - Tour AuRA 2026** (`2bcf9a41-…`) :

| Champ | Valeur (UTC) | Paris |
|---|---|---|
| `leagues.first_auction_starts_at` | 2026-06-03 12:00 | 03/06 14:00 ✅ |
| `auctions.opens_at` (round 1) | **2026-07-02 12:00** | 02/07 14:00 ❌ |
| `auctions.deadline_at` | 2026-07-03 12:00 | 03/07 14:00 |

→ Le décalage est d'exactement **29 jours**, ce qui correspond au compte à rebours affiché (29 j 22 h 34 m).

### Origine de la désynchronisation
- `leagues-create` insère bien `auctions.opens_at = firstAuctionStartsAt` (l.257) à la création.
- Aucune edge function ne modifie ensuite `opens_at` (aucun `update opens_at` sur per_course).
- La fonction `sync_phase_schedule_to_auctions` est restreinte à `game_mode IN ('five_phases','full_season')`, donc elle n'a pas touché cette ligue per_course.

→ La cause la plus probable : à la création la date saisie était bien le 02/07, puis `leagues.first_auction_starts_at` a été corrigé manuellement (admin / requête directe) sans propager la modification à la ligne `auctions`. Aujourd'hui il n'existe **aucun chemin UI ni edge function** pour éditer la date d'ouverture du round 1 d'une ligue `per_course`, donc la désynchro est durable.

## Plan de correction

### 1. Patch immédiat des données (1 requête)
Aligner `auctions.opens_at` / `deadline_at` du round 1 sur `leagues.first_auction_starts_at` pour cette ligue :

```sql
UPDATE public.auctions a
SET opens_at = l.first_auction_starts_at,
    deadline_at = l.first_auction_starts_at + interval '24 hours'
FROM public.leagues l
WHERE a.league_id = l.id
  AND a.id = 'a5fa16c8-b9ce-49f9-bc92-759f791afd41'
  AND a.statut = 'scheduled';
```

Effet : la carte affichera immédiatement « Ouverture dans 1 j » au lieu de 29 j.

### 2. Garde-fou structurel (recommandé)
Pour éviter que ça se reproduise sur d'autres ligues `per_course`, ajouter un **trigger** sur `leagues` qui propage `first_auction_starts_at` vers le round 1 `scheduled` :

```sql
CREATE OR REPLACE FUNCTION public.sync_first_auction_opens_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.first_auction_starts_at IS DISTINCT FROM OLD.first_auction_starts_at THEN
    UPDATE public.auctions
       SET opens_at   = NEW.first_auction_starts_at,
           deadline_at = NEW.first_auction_starts_at + interval '24 hours'
     WHERE league_id = NEW.id
       AND round_number = 1
       AND statut = 'scheduled';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_first_auction_opens_at
AFTER UPDATE OF first_auction_starts_at ON public.leagues
FOR EACH ROW EXECUTE FUNCTION public.sync_first_auction_opens_at();
```

### 3. Audit rapide des autres ligues
Vérifier s'il existe d'autres ligues impactées :

```sql
SELECT l.id, l.name, l.game_mode,
       l.first_auction_starts_at, a.opens_at
FROM leagues l
JOIN auctions a
  ON a.league_id = l.id AND a.round_number = 1 AND a.statut = 'scheduled'
WHERE l.first_auction_starts_at IS DISTINCT FROM a.opens_at
  AND l.status IN ('pending','active');
```

Si d'autres lignes apparaissent, élargir le UPDATE de l'étape 1 en `WHERE a.statut = 'scheduled' AND l.first_auction_starts_at IS DISTINCT FROM a.opens_at`.

## Fichiers concernés
- Aucun fichier TS/TSX à modifier.
- Une migration SQL pour les étapes 1 + 2 (+ audit étape 3 exécuté avant pour calibrer le UPDATE).
