
# Modifications du profil : Sponsor saisonnier et maillot

## Résumé des changements demandés

1. **Sponsor lié à la saison en cours** : Le sponsor affiché/modifiable doit provenir de la table `manager_sponsors` (liée à la saison) plutôt que de la table `managers`
2. **Supprimer la section "test" des notifications** : Retirer le bouton de test et les informations de debug
3. **Gestion du maillot par le manager** : Permettre au manager de voir, uploader ou modifier son maillot de sponsor pour la saison en cours

---

## 1. Migration de base de données

### Nouvelle politique RLS requise

Actuellement, seuls les superadmins peuvent modifier la table `manager_sponsors`. Il faut ajouter une politique permettant aux managers de gérer leur propre sponsor/maillot :

```sql
-- Permettre aux managers de mettre à jour leur propre sponsor pour une saison
CREATE POLICY "Managers can manage their own sponsors" 
ON public.manager_sponsors 
FOR ALL 
TO authenticated
USING (
  manager_id IN (
    SELECT id FROM public.managers 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  manager_id IN (
    SELECT id FROM public.managers 
    WHERE user_id = auth.uid()
  )
);
```

### RLS pour le bucket storage

Vérifier/ajouter une politique pour que les managers puissent uploader leurs propres maillots dans le bucket `sponsor-jerseys`.

---

## 2. Modifications de la page Compte (AccountPage.tsx)

### Changements dans le chargement des données

| Avant | Après |
|-------|-------|
| Sponsor lu depuis `managers.sponsor` | Sponsor lu depuis `manager_sponsors` pour la saison en cours |
| Pas de gestion de maillot | Affichage et upload du maillot lié à la saison |

### Nouvelles dépendances à importer

- `useSeasonContext` pour accéder à la saison en cours
- Logique d'upsert vers `manager_sponsors` avec `onConflict: 'manager_id,saison_id'`

### Nouveau composant : SponsorJerseyEditor

Créer un composant dédié pour la gestion du sponsor et du maillot dans le profil :

```text
src/components/account/SponsorJerseyEditor.tsx
```

Ce composant :
- Affiche le sponsor actuel de la saison en cours
- Permet de modifier le nom du sponsor
- Affiche le maillot actuel (ou un placeholder)
- Permet d'uploader un nouveau maillot
- Permet de supprimer le maillot

### Structure de l'interface

```text
┌─────────────────────────────────────────┐
│ 🏷️ Sponsor & Maillot                    │
│ Saison 2026                             │
├─────────────────────────────────────────┤
│                                         │
│  [Avatar Maillot]    Nom du sponsor:    │
│                      [_______________]  │
│                                         │
│  [Changer maillot] [Supprimer]          │
│                                         │
│  [Mettre à jour]                        │
└─────────────────────────────────────────┘
```

---

## 3. Modifications de NotificationSettings.tsx

### À supprimer (lignes 254-294)

- Bouton "Envoyer une notification test"
- Section "Debug Info" avec permission, SW State, Endpoint
- Bouton "Réinitialiser l'abonnement"

### À conserver

- Toggle principal des notifications push
- Les 3 types de préférences (résultats, startlists, enchères)

---

## 4. Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/xxx.sql` | Ajouter politique RLS pour manager_sponsors |
| `src/components/account/SponsorJerseyEditor.tsx` | **Créer** - Nouveau composant |
| `src/pages/AccountPage.tsx` | Modifier - Intégrer SponsorJerseyEditor, retirer l'ancien champ sponsor |
| `src/components/settings/NotificationSettings.tsx` | Modifier - Supprimer section test/debug |
| `src/i18n/locales/en/account.json` | Ajouter traductions sponsor/maillot |
| `src/i18n/locales/fr/account.json` | Ajouter traductions sponsor/maillot |

---

## 5. Logique de sauvegarde du sponsor

```typescript
// Upsert dans manager_sponsors avec gestion du conflit
const { error } = await supabase
  .from('manager_sponsors')
  .upsert({
    manager_id: managerId,
    saison_id: selectedSeason.id,
    sponsor: sponsorName,
    jersey_image_url: jerseyUrl, // conservé si non modifié
  }, {
    onConflict: 'manager_id,saison_id'
  });
```

---

## 6. Logique d'upload du maillot

Réutiliser la même logique que `SponsorJerseyManager.tsx` :

1. Sanitizer le nom du fichier (accents, caractères spéciaux)
2. Upload vers `sponsor-jerseys` bucket avec upsert
3. Ajouter un timestamp cache-buster à l'URL
4. Mettre à jour `manager_sponsors.jersey_image_url`

---

## Détails techniques

### Récupération de la saison en cours

La page AccountPage est rendue dans le Dashboard qui a le `SeasonProvider`. On peut utiliser :

```typescript
const { selectedSeason, isLoading: seasonLoading } = useSeasonContext();
```

### Gestion du cas "pas de saison"

Si aucune saison n'est sélectionnée, afficher un message informatif et désactiver les champs.

### Cache-busting pour le maillot

Après upload, ajouter `?t=${Date.now()}` à l'URL pour forcer le rafraîchissement de l'image.
