

# Plan : Ajout du Mode Sombre

## Résumé

L'ajout du mode sombre est **simple à implémenter** car l'infrastructure technique est déjà en place. Il suffit de connecter les éléments existants et d'ajouter un bouton de bascule.

## Ce qui existe déjà

| Element | Statut |
|---------|--------|
| Bibliothèque `next-themes` | ✅ Installée |
| Configuration Tailwind `darkMode: ["class"]` | ✅ Configurée |
| Variables CSS mode sombre (`.dark`) | ✅ Définies |
| Composants UI avec classes `dark:` | ✅ Partiellement présents |

## Étapes d'implémentation

### 1. Activer le ThemeProvider dans App.tsx

Envelopper l'application avec le `ThemeProvider` de `next-themes` :

```tsx
import { ThemeProvider } from "next-themes";

// Dans le return :
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {/* reste de l'app */}
</ThemeProvider>
```

### 2. Créer un composant ThemeSwitcher

Nouveau fichier `src/components/ui/ThemeSwitcher.tsx` avec :
- Icône Soleil/Lune
- Toggle entre light, dark, et system
- Design cohérent avec le `LanguageSwitcher` existant

### 3. Ajouter le toggle dans le Header

Dans `src/components/layout/Header.tsx`, ajouter le `ThemeSwitcher` à côté du `LanguageSwitcher` (ligne 167).

### 4. Ajouter une section "Apparence" dans la page Compte

Dans `src/pages/AccountPage.tsx`, ajouter une nouvelle `Card` "Apparence" avec :
- Sélecteur de thème (Clair / Sombre / Système)
- Description du paramètre

### 5. Ajuster les variables CSS du mode sombre

Le mode sombre actuel utilise des teintes bleues. On pourrait le rendre cohérent avec l'identité Tour de France en gardant le jaune comme accent :

```css
.dark {
  --background: 0 0% 8%;
  --foreground: 0 0% 98%;
  --primary: 48 100% 50%; /* Jaune conservé */
  --primary-foreground: 0 0% 0%;
  /* ... autres ajustements */
}
```

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/App.tsx` | Ajouter `ThemeProvider` |
| `src/components/ui/ThemeSwitcher.tsx` | **Nouveau fichier** - Bouton de bascule |
| `src/components/layout/Header.tsx` | Ajouter le `ThemeSwitcher` |
| `src/pages/AccountPage.tsx` | Ajouter section "Apparence" |
| `src/index.css` | Ajuster les couleurs `.dark` pour l'identité TdF |
| `public/locales/fr/account.json` | Ajouter traductions |
| `public/locales/en/account.json` | Ajouter traductions |

## Estimation

- **Complexité** : Faible
- **Temps estimé** : 15-20 minutes
- **Risque** : Minimal (infrastructure déjà en place)

