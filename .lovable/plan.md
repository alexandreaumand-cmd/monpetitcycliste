
# Configuration PWA pour Mon Petit Cycliste

## Objectif

Transformer l'application en Progressive Web App (PWA) installable avec :
- Fonctionnement hors-ligne
- Icône sur l'écran d'accueil
- Écran de lancement (splash screen)
- Page d'installation dédiée `/install`

---

## Apercu de l'architecture

```text
+------------------+     +-------------------+     +------------------+
|   vite-plugin-pwa |---->|  Service Worker  |---->| Cache hors-ligne |
+------------------+     +-------------------+     +------------------+
        |
        v
+------------------+     +-------------------+
|   manifest.json  |---->| Icônes PWA (512px)|
+------------------+     +-------------------+
        |
        v
+------------------+     +-------------------+
|  usePWAInstall   |---->|  Page /install   |
|     (hook)       |     |   avec guide     |
+------------------+     +-------------------+
```

---

## Modifications prevues

### 1. Installation de la dependance

Ajouter `vite-plugin-pwa` au projet :
- Package : `vite-plugin-pwa`
- Inclut automatiquement `workbox-build` pour le service worker

### 2. Configuration Vite (`vite.config.ts`)

Integrer le plugin PWA avec :
- Mode `generateSW` (generation automatique du service worker)
- Strategie de cache `CacheFirst` pour les assets
- Configuration du manifest inline

```text
Parametres cles :
- registerType: 'autoUpdate' (mise a jour automatique)
- includeAssets: ['favicon.png', 'favicon.ico']
- Cache: images, fonts, CSS, JS
```

### 3. Mise a jour de `index.html`

Ajouter les meta tags PWA essentiels :
- `<meta name="theme-color">` (jaune #FBBF24 pour cohérence Tour de France)
- `<meta name="apple-mobile-web-app-capable">`
- `<meta name="apple-mobile-web-app-status-bar-style">`
- Liens vers les icones Apple Touch

### 4. Creation des icones PWA

Generer a partir du `favicon.png` existant :
- `/public/pwa-192x192.png` (icone standard)
- `/public/pwa-512x512.png` (icone grande / splash)
- `/public/apple-touch-icon-180x180.png` (iOS)

Note : Comme le `favicon.png` actuel est deja en haute resolution, il servira de source.

### 5. Hook personnalise `usePWAInstall`

Nouveau fichier : `src/hooks/usePWAInstall.ts`

Fonctionnalites :
- Capture de l'evenement `beforeinstallprompt`
- Detection si deja installe (mode `standalone`)
- Detection du navigateur (iOS Safari, Android Chrome, etc.)
- Declenchement de l'installation native quand possible

```text
Interface retournee :
{
  isInstallable: boolean      // Prompt disponible
  isInstalled: boolean        // Deja installe
  isIOS: boolean              // Detection iOS
  isAndroid: boolean          // Detection Android
  install: () => Promise      // Declencher l'installation
}
```

### 6. Page d'installation `/install`

Nouveau fichier : `src/pages/InstallPage.tsx`

Design :
- Logo MPC en grand
- Titre accrocheur
- Bouton d'installation (si supporté nativement)
- Instructions manuelles pour iOS (Partager > Ajouter a l'ecran d'accueil)
- Instructions pour Android/Chrome
- Indication si deja installe

Sections :
1. En-tete avec logo
2. Avantages de l'installation (acces rapide, hors-ligne, notifications)
3. Bouton principal ou instructions selon la plateforme
4. Lien pour continuer sur le web

### 7. Mise a jour du routeur (`App.tsx`)

Ajouter la route :
```text
/install -> InstallPage
```

### 8. Traductions i18n

Nouveaux fichiers :
- `src/i18n/locales/fr/install.json`
- `src/i18n/locales/en/install.json`

Cles a traduire :
- Titre de la page
- Description des avantages
- Instructions iOS/Android
- Boutons et messages d'etat

Mise a jour de `src/i18n/index.ts` pour inclure le namespace `install`.

---

## Details techniques

### Configuration du manifest (via vite-plugin-pwa)

```text
{
  name: "Mon Petit Cycliste",
  short_name: "MPC",
  description: "Fantasy Cycling - Joue la saison, gagne la gloire",
  theme_color: "#FBBF24",
  background_color: "#000000",
  display: "standalone",
  orientation: "portrait",
  start_url: "/",
  scope: "/",
  icons: [...]
}
```

### Strategie de cache

- **Assets statiques** : Cache First (images, fonts, CSS, JS)
- **API calls** : Network First (donnees fraiches prioritaires)
- **Navigation** : Network First avec fallback offline

### Detection de plateforme

```text
iOS       : navigator.userAgent.includes('iPhone') || 'iPad'
Android   : navigator.userAgent.includes('Android')
Standalone: window.matchMedia('(display-mode: standalone)').matches
```

---

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `package.json` | Ajouter `vite-plugin-pwa` |
| `vite.config.ts` | Configurer le plugin PWA |
| `index.html` | Ajouter meta tags PWA |
| `public/pwa-192x192.png` | Creer icone (copie redimensionnee) |
| `public/pwa-512x512.png` | Creer icone (copie source) |
| `src/hooks/usePWAInstall.ts` | Nouveau hook |
| `src/pages/InstallPage.tsx` | Nouvelle page |
| `src/App.tsx` | Ajouter route /install |
| `src/i18n/locales/fr/install.json` | Traductions FR |
| `src/i18n/locales/en/install.json` | Traductions EN |
| `src/i18n/index.ts` | Importer namespace install |

---

## Resultat attendu

Apres implementation :
1. L'app sera installable depuis Chrome/Edge sur desktop et mobile
2. Sur iOS, la page `/install` guidera l'utilisateur etape par etape
3. Un service worker cachera les assets pour un chargement rapide
4. L'app s'ouvrira en mode plein ecran (sans barre d'adresse)
5. Une icone MPC apparaitra sur l'ecran d'accueil
