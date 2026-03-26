

## Alléger les cartes startlist desktop

### Problème
Les cartes de la page Startlist desktop sont surchargées :
1. Le badge "Startlist" est redondant (on est déjà sur la page startlists)
2. Le badge `type_course` ("Stage_race", "One_day") n'apporte pas de valeur
3. "En cours" apparaît 2 fois : badge rouge en haut + badge countdown en bas
4. "SL officielle" devrait être en vert (actuellement couleur primary)

### Modifications — `src/pages/Startlist.desktop.tsx`

**1. Supprimer le badge "Startlist"** (lignes 514-518)
Retirer complètement le badge `hasStartlist` avec l'icône CheckCircle2.

**2. Supprimer le badge `type_course`** (lignes 537-541)
Retirer le badge qui affiche "Stage_race" / "One_day".

**3. Dédoublonner "En cours"** (lignes 509-513 et 553-562)
Supprimer le badge rouge animé "EN COURS" en haut de la carte. Le label countdown en bas (`getCountdownLabel()`) affiche déjà "En cours" quand la course est en cours.

**4. Badge "SL officielle" en vert** (lignes 520-525)
Remplacer `bg-primary text-primary-foreground` par `bg-green-600 text-white border-green-600` pour un rendu vert cohérent avec les autres vues.

### Résultat attendu
- Cartes plus aérées avec uniquement : nom, catégorie (WT Cat 1, 2.1...), phase, date, countdown, et badge vert "SL officielle" si validée
- Plus de doublon "En cours"

### Fichier impacté
- `src/pages/Startlist.desktop.tsx` uniquement

