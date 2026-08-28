# Notifications coureur : afficher coureur, course et ligue

## Constat
Les notifications `rider_incident` (chute/abandon) et `rider_win` contiennent déjà toutes les infos dans leur **message** (ex. « Tu la sens la douille à 551M ? Chute de Wout Van Aert sur la Vuelta a España - Ligue MPC 2026 »), mais le centre de notifications n'affiche que le **titre** générique (« 💥 Chute d'un de tes coureurs ») — le message n'est jamais rendu. D'où l'absence du nom du coureur, de la course et de la ligue.

## Changement
`src/components/layout/NotificationCenter.tsx` : pour les types `rider_incident` et `rider_win`, afficher le **message** sous le titre (texte secondaire, tronqué sur 2 lignes).

Résultat visible :
```text
💥 Chute d'un de tes coureurs
Tu la sens la douille à 551M ? Chute de Wout Van Aert
sur la Vuelta a España - Ligue MPC 2026
il y a environ 18 heures
```

## Détails techniques
- Modification limitée au rendu de l'item de notification : ajout d'un `<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{translated.message}</p>` affiché uniquement pour `rider_incident` / `rider_win` (les autres types gardent leur rendu actuel pour éviter les doublons titre/message).
- Aucun changement backend, base de données, ni de logique d'envoi (push inchangé).
