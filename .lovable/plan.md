# Revenir en arrière sur la phase active en LIVE

## Objectif
Remettre **la phase 2** comme phase active à la date du **2026-05-07** et annuler l’activation précédente de la phase 3.

## État vérifié
- Aujourd’hui en LIVE: **2026-05-07**
- **Phase 2** (`8b939cb8-7079-4938-ba00-920603813092`) est actuellement `completed`
- **Phase 3** (`61a9cda5-5d45-4776-bf5e-78fb0e14cc80`) est actuellement `active`
- La ligue **CopaGIRO** a bien un scope fixé sur la phase 3 via `league_scopes.phases = [61a9cda5-5d45-4776-bf5e-78fb0e14cc80]`

## Action à appliquer en LIVE
Exécuter ce SQL dans **Cloud → Run SQL (Live)** :

```sql
-- Remettre la phase 2 active pour aujourd'hui
UPDATE public.phases
SET statut = 'active',
    date_fin = '2026-05-07'
WHERE id = '8b939cb8-7079-4938-ba00-920603813092';

-- Rebasculer la phase 3 en phase à venir
UPDATE public.phases
SET statut = 'completed',
    date_debut = '2026-05-08'
WHERE id = '61a9cda5-5d45-4776-bf5e-78fb0e14cc80';

-- Vérification
SELECT id, index_dans_saison, statut, date_debut, date_fin
FROM public.phases
WHERE saison_id = '74a561e7-06c5-4ddd-988d-d4f4449f42f5'
ORDER BY index_dans_saison;
```

## Résultat attendu
- Le calcul de phase active de la saison repassera sur **la phase 2** aujourd’hui.
- Cela annule le changement précédent sur le calendrier.

## Point important
Ce rollback remet bien le calendrier comme avant, **mais il ne corrigera probablement pas l’onglet équipe de CopaGIRO**, car cette ligue est en mode **à la course** et son scope reste explicitement fixé sur **la phase 3**. Si tu veux, l’étape suivante sera de préparer un correctif ciblé SQL pour la ligue elle-même, sans publication.

## Détail technique
- Saison concernée: `74a561e7-06c5-4ddd-988d-d4f4449f42f5`
- Phase 2: `8b939cb8-7079-4938-ba00-920603813092`
- Phase 3: `61a9cda5-5d45-4776-bf5e-78fb0e14cc80`
- Ligue CopaGIRO: `2b08ea2c-0c6a-48fd-83d4-40e0e3574643`
- Scope ligue actuel: `league_scopes.phases = [61a9cda5-5d45-4776-bf5e-78fb0e14cc80]`
