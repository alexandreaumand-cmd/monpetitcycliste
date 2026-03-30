

# Visuels X.com pour La Bordure

## Objectif
Générer 4 visuels PNG 1080x1080 prêts à publier sur X.com, chacun mettant en avant une fonctionnalité clé de l'app.

## Visuels prévus

| # | Thème | Screenshot utilisé | Accroche |
|---|-------|--------------------|----------|
| 1 | Enchères | `encheres.png` | "Recrute aux enchères entre amis" |
| 2 | Classement | `ranking.png` | "Domine le classement" |
| 3 | Équipes | `team.png` | "Suis les perfs de ton équipe" |
| 4 | Résultats / Calendrier | `startlist.png` | "Suis le calendrier pro" |

## Design de chaque visuel

```text
┌──────────────────────────────┐
│  LA BORDURE          logo    │  ← barre supérieure verte
│                              │
│   RECRUTE AUX                │  ← titre Montserrat Bold blanc
│   ENCHÈRES                   │
│   ENTRE AMIS.                │
│                              │
│   ┌─────────────────────┐    │
│   │                     │    │
│   │   Screenshot app    │    │  ← screenshot dans un cadre phone/browser
│   │   (encheres.png)    │    │
│   │                     │    │
│   └─────────────────────┘    │
│                              │
│  ── ── ── ──                 │  ← bandes tricolores vert/or/rose
│  labordure.app    Saison 2025│  ← footer
└──────────────────────────────┘
```

- **Fond** : vert foncé `#1B5E3B` (cohérent avec la marque)
- **Texte titre** : blanc, police Montserrat Bold, grande taille
- **Accent** : mot-clé en or `#C8963A` (italic)
- **Screenshot** : encadré dans un mockup arrondi avec ombre portée
- **Bandes décoratives** : 3 traits (vert/or/rose) comme sur la homepage
- **Footer** : `labordure.app` + `Saison 2025`

## Approche technique

1. Copier le script AI gateway vers `/tmp/`
2. Pour chaque visuel, utiliser un script Python (Pillow) qui :
   - Crée un canvas 1080x1080 fond vert foncé
   - Charge le screenshot depuis `public/screenshots/`
   - Ajoute le texte (titre, sous-titre, URL) avec les polices du projet
   - Dessine les bandes décoratives tricolores
   - Place le screenshot dans un cadre arrondi avec ombre
3. Exporter chaque PNG dans `/mnt/documents/`
4. QA visuelle : convertir et inspecter chaque image

## Fichiers générés

- `/mnt/documents/labordure-xcom-encheres.png`
- `/mnt/documents/labordure-xcom-classement.png`
- `/mnt/documents/labordure-xcom-equipes.png`
- `/mnt/documents/labordure-xcom-calendrier.png`

