

## Refonte de l'onglet Pronostics

### Changements prevus

**1. Supprimer les 3 vignettes stats** (Total / Corrects / Incorrects) - lignes 102-127 de `PronosticsTab.tsx`

**2. Remplacer les accordeons par des sous-onglets**

Quatre sous-onglets remplaceront les sections accordeon actuelles :

- **En cours** (defaut) : pronostics dont la deadline est passee mais dont les resultats n'ont pas encore ete evalues (= actuels "pendingDeadlines")
- **A venir** : pronostics dont la deadline n'est pas encore passee, a effectuer (= actuels "openDeadlines")  
- **Passes** : resultats evalues, tries par date decroissante (= actuels "evaluatedDeadlines")
- **Classement** : le composant `PronosticStandings` existant

**3. Condenser les cartes pronostic sur 2 lignes**

Actuellement chaque `PronosticRaceCard` affiche 4 lignes (course, type, cloture, coureur). Nouvelle disposition :

```text
Ligne 1 : [Nom course]  [Badge type + categorie]  [Icone statut]
Ligne 2 : [Horloge + deadline]  [Selecteur coureur OU resultat]
```

**4. Replier tous les accordeons par defaut**

Changer `defaultValue={["open", "pending", "evaluated"]}` pour `defaultValue={[]}` sur les accordeons restants dans les sous-onglets (si on garde des groupes), ou simplement lister les cartes directement.

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/components/arena/PronosticsTab.tsx` | Remplacer stats + accordeons par sous-onglets (TabGroup ou Tabs). Reorganiser la logique de tri. |
| `src/components/arena/PronosticRaceCard.tsx` | Condenser le layout sur 2 lignes : fusionner header + deadline + selecteur. |
| `src/i18n/locales/fr/arena.json` | Ajouter les cles `pronostics.tabs.inProgress`, `pronostics.tabs.upcoming`, `pronostics.tabs.past`, `pronostics.tabs.standings` |
| `src/i18n/locales/en/arena.json` | Idem en anglais |

### Details techniques

**PronosticsTab.tsx** :
- Utiliser le composant `TabGroup` mobile existant (`src/components/mobile/TabGroup.tsx`) pour les sous-onglets, coherent avec le design mobile-first
- Etat local `useState("inprogress")` pour gerer le sous-onglet actif
- Pour "Passes" : trier `evaluatedDeadlines` par `deadline.courses?.date_debut` ou `deadline.deadline_at` decroissant

**PronosticRaceCard.tsx** :
- Ligne 1 : `div flex items-center gap-2` avec nom course (truncate), badges type + categorie, icone statut a droite
- Ligne 2 : `div flex items-center gap-2` avec info deadline a gauche, selecteur/resultat a droite (ou en dessous sur mobile)
- Supprimer l'espacement vertical (`space-y-3` → `space-y-1.5`)
