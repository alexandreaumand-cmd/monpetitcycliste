# Live : km restants et bouton « Live » en direct

## 1. Kilométrage restant à côté des noms de courses

Dans le sélecteur de course de la page Live (mobile et desktop), chaque bouton de course affiche, après le nom et la catégorie, le kilométrage restant : `🏁 40,2 km`.

- La valeur vient de la situation de course enregistrée par le suivi automatique, donc elle se met à jour à chaque scraping (rafraîchissement toutes les ~30 s, plus au retour dans l'application).
- Si aucune valeur n'est disponible (course pas encore commencée), un tiret discret gris est affiché (`– km`) pour garder l'alignement.

## 2. Bouton « Live » en rouge quand une course est réellement en direct

Dans la barre du bas (mobile), le bouton « Live » passe en rouge (avec l'icône qui pulse légèrement) dès qu'au moins une course est réellement en direct, c'est-à-dire :

- sa situation a été mise à jour il y a moins de 30 minutes, ou
- l'heure actuelle (Paris) tombe dans une de ses plages horaires de suivi.

Sinon, le bouton garde son apparence actuelle. L'état sélectionné reste visible (le rouge se combine à la mise en avant de l'onglet actif).

## Détails techniques

- `src/components/arena/LiveCourseSelector.tsx` : le hook `useLiveCourses` ajoute `current_race_situation`, `situation_updated_at` et `scrape_schedule` au `select` sur `arena_live_courses` ; le bouton affiche `race_situation.kmRemaining` formaté en français.
- Nouveau hook `src/hooks/useAnyLiveNow.ts` : réutilise `useLiveCourses` et `stageStateFromSchedule` (déjà présent dans `useLiveStageStatus.ts`) pour retourner un booléen « au moins une course en direct », avec un tick à la minute et `refetchInterval` de 60 s.
- `src/components/mobile/MobileBottomBar.tsx` : consomme ce hook et applique des classes rouges (jetons de thème `destructive`) sur l'entrée Live, plus `animate-pulse` sur l'icône.
- Aucune modification de base de données ni de logique de calcul.
