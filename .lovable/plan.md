# Fix : la page Super Admin > Blessés est vide

## Diagnostic

- Les 5 blessures sont bien scrappées et stockées (Christen, Laporte, Kelderman, Yates, Vendrame), toutes encore actives.
- Les RLS autorisent bien la lecture (`Everyone can view rider injuries`).
- La requête de `SuperAdminInjuriesPage` utilise un join PostgREST `coureur:coureurs(nom, equipe)`, mais **aucune foreign key n'existe** entre `rider_injuries.coureur_id` et `coureurs.coureur_id`. PostgREST échoue → la liste reste vide.

## Correctif

### 1. Migration : ajouter la FK
```sql
ALTER TABLE public.rider_injuries
  ADD CONSTRAINT rider_injuries_coureur_id_fkey
  FOREIGN KEY (coureur_id) REFERENCES public.coureurs(coureur_id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_rider_injuries_coureur_id
  ON public.rider_injuries(coureur_id);
```

### 2. Aucune autre modification
Le composant `SuperAdminInjuriesPage.tsx`, le hook `useActiveInjuries`, et l'edge function restent inchangés. Une fois la FK ajoutée, le join `coureur:coureurs(nom, equipe)` fonctionnera et les 5 blessés s'afficheront.

## Vérification
Après la migration, ouvrir Super Admin > Blessés : les 5 coureurs blessés doivent apparaître avec leur nom et équipe.
