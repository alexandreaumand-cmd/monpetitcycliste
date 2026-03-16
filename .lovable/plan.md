

# Plan : Remplacement du logo horizontal

## Cible
Remplacer `src/assets/mpc-logo-horizontal.png` (actuellement "Mon Petit Cycliste") par le nouveau logo "La Bordure Fantasy Cycling" uploadé.

## Fichiers utilisant ce logo
- `src/components/mobile/MobileLayout.tsx` — header mobile principal
- `src/components/auction/v2/AuctionHeaderMobile.tsx` — header des enchères mobile  
- `src/pages/SuperAdminPage.mobile.tsx` — header admin mobile

## Action
Copier le nouveau logo uploadé (`Generated_Image_March_16_2026_-_2_48PM.png`) pour remplacer `src/assets/mpc-logo-horizontal.png`.

Les 3 fichiers TypeScript utilisent déjà l'import correct :
```tsx
import mpcLogo from "@/assets/mpc-logo-horizontal.png";
```

Aucune modification de code nécessaire — seul le fichier image est remplacé.

