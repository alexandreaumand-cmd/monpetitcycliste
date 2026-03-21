

## Visuels réseaux sociaux — La Bordure

### Ce que je vais créer

Un set de **5 visuels** adaptés aux 3 plateformes, avec l'identité visuelle La Bordure (Crème #F6F3ED, Vert #1B5E3B, Or #C8963A, Rose #E8A0B4) :

| Visuel | Format | Usage |
|--------|--------|-------|
| **Bannière X** | 1500×500 px | Header de profil X |
| **Post X** | 1200×675 px | Post/annonce |
| **Bannière LinkedIn** | 1584×396 px | Header de page LinkedIn |
| **Post LinkedIn** | 1200×627 px | Post/annonce |
| **Post Instagram** | 1080×1080 px | Post carré feed |

### Direction artistique

Chaque visuel reprend :
- Le **logo La Bordure** (variante adaptée au fond)
- La palette brand : fond crème ou vert forêt, accents or et rose
- Typographie Montserrat bold uppercase pour les titres
- Un screenshot de l'app ou photo cyclisme en élément visuel
- Accroche courte type "Fantasy Cycling — Compose ton équipe. Ridiculise tes potes."
- Les bandes décoratives tricolores (vert/or/rose) comme signature visuelle

### Approche technique

- Génération via script Python (Pillow) avec les assets existants du projet (logos, screenshots, photos)
- Polices Montserrat + Inter chargées localement
- Export PNG haute qualité dans `/mnt/documents/`
- QA visuel de chaque fichier avant livraison

### Fichiers générés

```
/mnt/documents/
├── x-banner-1500x500.png
├── x-post-1200x675.png
├── linkedin-banner-1584x396.png
├── linkedin-post-1200x627.png
└── instagram-post-1080x1080.png
```

