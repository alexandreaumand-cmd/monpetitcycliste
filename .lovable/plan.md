# Correction du nom d'expéditeur des emails d'enchères

## Problème
Dans la boîte de réception, les emails d'enchères (round ouvert, round clôturé, etc.) s'affichent avec l'expéditeur **« monpetitcycliste »** au lieu de **« La Bordure »**.

## Cause
Dans `supabase/functions/send-transactional-email/index.ts` ligne 10, la constante `SITE_NAME` est codée en dur à `"monpetitcycliste"`. Cette valeur est utilisée à la ligne 331 pour construire l'en-tête `From` :
```
from: `${SITE_NAME} <contact@${FROM_DOMAIN}>`
```
C'est ce nom qui apparaît dans la colonne expéditeur des clients mail.

À noter : la fonction `auth-email-hook` (emails d'authentification) utilise déjà `SITE_NAME = "La Bordure"` — seule la fonction transactionnelle est incorrecte.

## Correction
1. Modifier `supabase/functions/send-transactional-email/index.ts` ligne 10 : remplacer `"monpetitcycliste"` par `"La Bordure"`.
2. La fonction sera redéployée automatiquement.

## Résultat attendu
Les prochains emails (ouverture/clôture de round, ligue publique créée, etc.) afficheront **« La Bordure »** comme expéditeur.
