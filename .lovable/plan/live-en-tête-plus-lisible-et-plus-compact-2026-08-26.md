# Live : en-tête plus lisible et plus compact

Les annotations pointent vers la zone entourée (badge « Étape 5 en direct » + ligne de filtre « Étape : Toutes / É4 / … ») et remontent vers la barre « Choisir une course ». Trois problèmes concrets à corriger dans cet écran desktop.

## 1. Badges illisibles

- Le badge de l'étape sélectionnée qui est aussi l'étape en direct s'affiche actuellement en texte rouge sur fond orange : le « É5 » est invisible (la pastille orange vide dans la capture).
  Correction : quand une étape est sélectionnée, on garde le style « sélectionné » (fond primaire + texte lisible) et on ne signale le direct que par la pastille clignotante, sans forcer le rouge sur le texte.
- Le badge « ÉTAPE 5 EN DIRECT » (texte rouge sur fond rouge très sombre) passe sur un fond plein contrasté pour être lisible en thème sombre comme clair.

## 2. Fusion des deux barres en une seule ligne

Aujourd'hui on empile : barre « Choisir une course » (avec « 1 sélectionnée »), puis une bande avec le badge direct, puis une bande avec le filtre d'étape. C'est trois lignes pour trois informations courtes.

Nouvelle organisation : une seule barre d'en-tête par panneau de course contenant, sur la même ligne :

```text
[● Nom de la course]  [● ÉTAPE 5 EN DIRECT]        Étape : [Toutes] [É4] [É5 ●]
```

- Nom de la course + badge d'état à gauche, filtre d'étapes aligné à droite (défilement horizontal si beaucoup d'étapes).
- La bande de filtre séparée est supprimée ; le compteur « 1 sélectionnée » reste dans l'en-tête repliable « Choisir une course ».
- Gain : environ 2 lignes de hauteur récupérées pour la timeline et le profil.

## 3. Bloc « Profil »

- Le titre « Profil / Étape 5 » se lit mal car l'étape passe à la ligne : titre et numéro d'étape sur une seule ligne, sans retour.
- L'image du parcours est centrée dans une large zone vide : elle sera étirée sur toute la largeur disponible (hauteur max conservée) pour supprimer les bandes vides de part et d'autre.

## Détails techniques

- `src/components/arena/LiveCoursePanel.tsx` : fusion de l'en-tête nom de course + `LiveStageBadge` + `stageFilter` en un seul bloc `flex` ; correction des classes du badge d'étape live/sélectionnée ; ajustement du bloc `Profil` (titre `whitespace-nowrap`, image `w-full object-cover`/`object-contain` pleine largeur).
- `src/components/arena/LiveStageBadge.tsx` : variante « live » plus contrastée (fond plein `bg-destructive` + `text-destructive-foreground`), variante non-live inchangée.
- `src/components/arena/LiveCoursesTab.tsx` (vue mobile) : même correction de contraste sur le badge d'étape sélectionnée pour rester cohérent ; la structure mobile en accordéons reste inchangée.
- Aucun changement de logique métier : filtres, requêtes et états de direct restent identiques.
