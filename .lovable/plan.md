
# Suppression du bloc Personnalisation

## Changement demandé

Supprimer la section "Personnalisation" de la page Compte, qui n'est actuellement qu'un placeholder "Bientôt disponible".

---

## Modifications à effectuer

### 1. AccountPage.tsx

**Lignes à supprimer : 245-269**
```tsx
{/* Section Personnalisation */}
<Card className="mb-6">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Palette className="h-5 w-5" />
      {t('customization.title')}
    </CardTitle>
    ...
  </CardHeader>
  ...
</Card>
```

**Import à retirer (ligne 9)**
```tsx
import { Loader2, User, Lock, Palette } from "lucide-react";
// Devient :
import { Loader2, User, Lock } from "lucide-react";
```

---

## Nettoyage optionnel

Les traductions `customization.*` dans les fichiers de langue peuvent être conservées pour un usage futur ou supprimées pour nettoyer le code :

| Fichier | Clés concernées |
|---------|-----------------|
| `src/i18n/locales/en/account.json` | `customization.title`, `customization.description`, `customization.comingSoon` |
| `src/i18n/locales/fr/account.json` | `customization.title`, `customization.description`, `customization.comingSoon` |

---

## Résumé

| Fichier | Action |
|---------|--------|
| `src/pages/AccountPage.tsx` | Supprimer le bloc Card "Personnalisation" (lignes 245-269) et l'import `Palette` |
