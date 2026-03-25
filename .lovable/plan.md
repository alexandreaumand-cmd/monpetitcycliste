

# Fix : Phase active incorrecte en LIVE

## Diagnostic

La table `phases` en LIVE a les statuts inversés pour la saison 2026 :
- **Phase 1** (fin le 21/03) → `statut = 'active'` ❌ devrait être `completed`
- **Phase 2** (début le 22/03, fin le 08/05) → `statut = 'completed'` ❌ devrait être `active`

Aujourd'hui (25/03), on est bien en Phase 2. Mais **15+ composants** utilisent `statut === 'active'` pour afficher "(en cours)", sélectionner la phase par défaut, etc.

## Solution en 2 parties

### 1) Corriger les données en base (migration SQL)

```sql
-- Phase 1 saison 2026 : active → completed
UPDATE phases SET statut = 'completed' 
WHERE id = '73e540d2-d008-4d13-ac93-72aec3d5d986';

-- Phase 2 saison 2026 : completed → active
UPDATE phases SET statut = 'active' 
WHERE id = '8b939cb8-7079-4938-ba00-920603813092';
```

### 2) Automatiser le changement de statut (prévention)

Créer un **cron job quotidien** qui met à jour automatiquement les statuts des phases selon les dates :
- `date_fin < today` → `completed`
- `date_debut <= today <= date_fin` → `active`

Cela évitera que le problème se reproduise à chaque transition de phase.

**Implémentation** : une fonction SQL appelée par `pg_cron` à 00:05 UTC chaque jour.

```sql
CREATE OR REPLACE FUNCTION auto_update_phase_statuts()
RETURNS void AS $$
BEGIN
  UPDATE phases SET statut = 'completed' 
  WHERE date_fin < CURRENT_DATE AND statut != 'completed';
  
  UPDATE phases SET statut = 'active' 
  WHERE date_debut <= CURRENT_DATE AND date_fin >= CURRENT_DATE AND statut != 'active';
END;
$$ LANGUAGE plpgsql;
```

## Fichiers modifiés
- Migration SQL uniquement (correction données + fonction + cron)
- Aucun fichier code à modifier (les composants utilisent déjà correctement `statut`)

## Résultat
- Phase 2 s'affiche immédiatement comme "(en cours)" partout
- Les transitions futures seront automatiques

