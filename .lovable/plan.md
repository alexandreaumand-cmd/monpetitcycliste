
Objectif
- Empêcher définitivement (sur iOS en PWA installée) que le contenu du header “Mon Petit Cycliste” soit “mangé” par la barre de statut (heure/batterie).

Constat (ce que je déduis)
- La classe `safe-top` est bien présente sur `DashboardHomeHeader`, donc si le contenu est encore coupé en PWA iOS, c’est très probablement que iOS affiche la page “sous” la status bar parce que le mode **translucide** est activé.
- Dans `index.html`, on a :  
  `apple-mobile-web-app-status-bar-style = "black-translucent"`  
  En PWA installée, ce mode dit explicitement à iOS : “dessine sous la barre de statut”. Normalement `env(safe-area-inset-top)` compense, mais sur certaines versions/configurations iOS/PWA ça peut rester à 0 ou être mal appliqué (cache PWA, bug WebKit, etc.), ce qui donne exactement “contenu coupé”.

Solution proposée (robuste)
1) Rendre la status bar non translucide en PWA iOS (solution la plus fiable)
- Modifier `index.html` :
  - Remplacer `apple-mobile-web-app-status-bar-style` de `black-translucent` vers `black` (ou `default`).
  - Option recommandée ici : `black`, car votre header est noir → rendu cohérent, et iOS réserve l’espace automatiquement (plus de chevauchement).

2) Renforcer la gestion “safe area” côté CSS (au cas où)
- Dans `src/index.css`, rendre `.safe-top` plus robuste :
  - Support de `constant(safe-area-inset-top)` (anciens iOS)
  - Et garder `env(safe-area-inset-top)`
- Exemple d’intention (sans figer le code exact ici) :
  - `padding-top: constant(safe-area-inset-top);`
  - `padding-top: env(safe-area-inset-top);`

3) Vérification ciblée sur la page concernée
- Confirmer que le header affiché sur `/dashboard/home` est bien `DashboardHomeHeader` (c’est le cas).
- Tester sur iPhone encoche en PWA installée :
  - À froid (après fermeture complète)
  - Et après scroll (sticky header).

Point important (cache PWA iOS)
- Les PWAs iOS gardent parfois en cache l’HTML/meta et le “mode” status bar. Même après un déploiement, certains iPhones ne prennent pas immédiatement les nouvelles meta tags.
- Après le fix, côté utilisateurs iOS (PWA installée), il faudra souvent :
  1) Fermer l’app (app switcher → swipe pour fermer)
  2) Relancer
  3) Si ça persiste : supprimer l’app de l’écran d’accueil et la réinstaller (Add to Home Screen) pour forcer iOS à réappliquer les meta PWA.

Fichiers concernés
- `index.html`
  - Changer `apple-mobile-web-app-status-bar-style`
  - (Optionnel) ajuster `theme-color` si on veut mieux matcher le noir du header sur iOS
- `src/index.css`
  - Renforcer `.safe-top` avec `constant()` + `env()`

Critères d’acceptation
- Sur iPhone avec encoche, en PWA installée :
  - Le logo/les icônes du header ne sont plus sous la barre iOS
  - Aucune zone “cliquable” n’est masquée
- Sur Android / Desktop : aucun changement visuel notable.

Risques / trade-offs
- Passer de `black-translucent` à `black` enlève l’effet “contenu sous la status bar” (mais c’est précisément ce qu’on veut ici pour stopper le chevauchement).
- Sur certains devices, il peut y avoir un léger changement de rendu de la barre de statut (attendu).

Ce dont j’ai besoin (très court)
- Confirmer la version iOS : tu as répondu “26.2” — c’est probablement “16.2” ? (je vais partir sur l’hypothèse iOS 16.x/17.x mais si tu confirmes, ça aide à cadrer le bug WebKit).
