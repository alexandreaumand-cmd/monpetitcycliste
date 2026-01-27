
# Génération d'un badge monochrome pour les notifications Android

## Objectif
Créer une version monochrome (silhouette blanche sur fond transparent) du logo MPC pour résoudre le problème du "carré blanc" dans la barre de statut Android.

## Ce que je vais faire

### 1. Générer l'image monochrome
Utiliser l'IA de génération d'images pour créer une version du logo MPC :
- **Format** : 96x96 pixels PNG
- **Style** : Silhouette blanche sur fond transparent
- **Contenu** : L'écusson MPC avec les lettres et la roue de vélo

### 2. Ajouter l'image au projet
- Sauvegarder l'image générée dans `public/notification-badge-96x96.png`

### 3. Modifier le Service Worker
Mettre à jour `public/sw-push.js` pour utiliser cette nouvelle image :

```javascript
const options = {
  icon: '/pwa-192x192.png',           // Logo couleur (notification principale)
  badge: '/notification-badge-96x96.png', // Logo monochrome (barre de statut)
  // ...
};
```

## Résultat attendu
- **Panneau de notifications** : Le logo couleur jaune/noir s'affichera
- **Barre de statut** : L'icône monochrome blanche s'affichera correctement (plus de carré blanc)

## Note technique
Après déploiement, il faudra peut-être réinstaller l'app sur l'écran d'accueil pour forcer le rafraîchissement du Service Worker et des assets.
