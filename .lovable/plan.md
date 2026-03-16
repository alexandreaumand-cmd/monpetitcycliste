

# Plan : Remplacement des logos La Bordure

## Logos uploadés

4 variantes identifiées dans les images :

```text
Image 2/3 → Icône seule (casquette)        → remplace mpc-logo.png
Image 4   → Horizontal (casquette + texte)  → remplace mpc-logo-horizontal.png  
Image 1   → Vertical (casquette + texte)    → nouveau : mpc-logo-vertical.png
```

## Correspondance fichier → logo

### Icône seule (casquette) — `mpc-logo.png` (15 fichiers)
Utilisé partout où le logo apparaît en petit (32-48px) : headers, sidebar, loading spinner, pages auth/invite/calendar/data.

- `Header.tsx` — barre de navigation dashboard
- `DashboardHomeHeader.tsx` — header accueil
- `MobileHeader.tsx` — header mobile
- `LandingHeader.tsx` — header landing
- `LandingFooter.tsx` — footer landing
- `AppSidebar.tsx` — sidebar desktop
- `LoadingSpinner.tsx` — spinner de chargement
- `Auth.tsx` — page connexion
- `InvitePage.tsx` — page invitation
- `CalendarPage.tsx` — calendrier
- `RidersData.tsx` — données coureurs
- `Index.tsx` — page index

### Horizontal (casquette + texte) — `mpc-logo-horizontal.png` (3 fichiers)
Utilisé dans les contextes mobiles où on affiche le logo en largeur :

- `MobileLayout.tsx`
- `AuctionHeaderMobile.tsx`
- `SuperAdminPage.mobile.tsx`

### Vertical (casquette + texte empilé) — `mpc-logo-vertical.png` (nouveau)
À intégrer dans les contextes d'affichage grand format :

- `Auth.tsx` — remplacer l'icône par le logo vertical complet
- `InvitePage.tsx` — idem
- `LandingFooter.tsx` — logo footer plus visible

## Actions

1. Copier les 3 images dans `src/assets/` :
   - Image 2 → `src/assets/mpc-logo.png` (écrase l'ancien)
   - Image 4 → `src/assets/mpc-logo-horizontal.png` (écrase l'ancien)
   - Image 1 → `src/assets/mpc-logo-vertical.png` (nouveau)

2. Mettre à jour `Auth.tsx`, `InvitePage.tsx`, `LandingFooter.tsx` pour importer et afficher `mpc-logo-vertical.png` au lieu de l'icône seule

3. Aucun changement nécessaire pour les 12 autres fichiers — ils importent déjà `mpc-logo.png` qui sera écrasé

**Fichiers impactés : 3 copies d'assets + 3 fichiers .tsx modifiés**

