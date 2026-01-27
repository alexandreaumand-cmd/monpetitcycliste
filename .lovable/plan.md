

# Optimiser l'affichage de la page Mon Compte sur mobile

## Problemes identifies

D'apres la capture d'ecran, la page "Mon Compte" presente plusieurs problemes sur mobile :

1. **Titre trop volumineux** - `text-3xl` avec `py-8` cree beaucoup d'espace vide
2. **Descriptions redondantes** - Les `CardDescription` sont inutiles sur petit ecran
3. **Avatar mal positionne** - Centre avec beaucoup d'espace blanc autour
4. **Layout inefficace** - Avatar et champs empiles verticalement au lieu d'etre cote a cote
5. **Espacements excessifs** - `mb-6`, `space-y-6`, `gap-6` trop genereux sur mobile

---

## Solution proposee

Creer un layout compact pour mobile avec :
- Reduction des marges et paddings
- Masquage des descriptions sur mobile
- Layout horizontal Avatar + Champs meme sur mobile
- Titre plus compact

---

## Modifications techniques

### Fichier : `src/pages/AccountPage.tsx`

**1. Reduire le padding du container (ligne 120)**

| Avant | Apres |
|-------|-------|
| `px-4 py-8` | `px-4 py-4 md:py-8` |

**2. Reduire la taille du titre (ligne 121)**

| Avant | Apres |
|-------|-------|
| `text-3xl font-bold mb-6` | `text-2xl font-bold mb-4 md:text-3xl md:mb-6` |

**3. Masquer CardDescription sur mobile (lignes 130-132)**

```tsx
<CardDescription className="hidden sm:block">
  {t('profile.description')}
</CardDescription>
```

**4. Layout horizontal sur mobile pour le profil (ligne 136)**

| Avant | Apres |
|-------|-------|
| `flex flex-col sm:flex-row gap-6` | `flex flex-row gap-4` |

**5. Reduire les marges entre les cartes (ligne 124, 198)**

| Avant | Apres |
|-------|-------|
| `className="mb-6"` | `className="mb-4 md:mb-6"` |

---

### Fichier : `src/components/account/AvatarUploader.tsx`

**6. Reduire la taille de l'avatar sur mobile (ligne 131)**

| Avant | Apres |
|-------|-------|
| `h-20 w-20` | `h-16 w-16 sm:h-20 sm:w-20` |

**7. Ajuster le fallback text (ligne 135)**

| Avant | Apres |
|-------|-------|
| `text-2xl` | `text-xl sm:text-2xl` |

---

### Fichier : `src/components/account/SponsorJerseyEditor.tsx`

**8. Masquer CardDescription sur mobile (lignes 194-199)**

```tsx
<CardDescription className="hidden sm:block">
  {selectedSeason 
    ? t('sponsorJersey.descriptionWithSeason', { season: selectedSeason.annee })
    : t('sponsorJersey.description')
  }
</CardDescription>
```

**9. Reduire la taille de l'avatar maillot (ligne 219)**

| Avant | Apres |
|-------|-------|
| `h-24 w-24` | `h-16 w-16 sm:h-24 sm:w-24` |

**10. Reduire les espacements internes (ligne 201)**

| Avant | Apres |
|-------|-------|
| `space-y-6` | `space-y-4 sm:space-y-6` |

---

### Fichier : `src/components/settings/NotificationSettings.tsx`

**11. Masquer CardDescription sur mobile (lignes 59-61)**

```tsx
<CardDescription className="hidden sm:block">
  {t('notifications.description')}
</CardDescription>
```

**12. Reduire les espacements internes (ligne 63)**

| Avant | Apres |
|-------|-------|
| `space-y-6` | `space-y-4 sm:space-y-6` |

---

## Resultat visuel attendu

### Avant (screenshot actuel)
```text
┌─────────────────────────────┐
│                             │
│  Mon Compte                 │  ← Grand titre
│                             │
│ ┌─────────────────────────┐ │
│ │ Profil                  │ │
│ │ Gérez vos infos...      │ │  ← Description inutile
│ │                         │ │
│ │      [Avatar]           │ │  ← Centré, espace perdu
│ │        📷 🗑             │ │
│ │                         │ │
│ │ Email                   │ │
│ │ [input]                 │ │
│ │                         │ │
│ │ Nom du manager          │ │
│ │ [input]                 │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Apres (optimise)
```text
┌─────────────────────────────┐
│  Mon Compte                 │  ← Titre compact
│ ┌─────────────────────────┐ │
│ │ Profil                  │ │  ← Pas de description
│ │ [Avatar]  Email         │ │  ← Layout horizontal
│ │  📷 🗑    [input]        │ │
│ │          Nom manager    │ │
│ │          [input]        │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Sponsor & Maillot       │ │  ← Moins d'espace
│ │ ...                     │ │
└─────────────────────────────┘
```

---

## Resume des fichiers a modifier

| Fichier | Modifications |
|---------|---------------|
| `src/pages/AccountPage.tsx` | Padding, titre, layout horizontal, marges reduites |
| `src/components/account/AvatarUploader.tsx` | Taille avatar responsive |
| `src/components/account/SponsorJerseyEditor.tsx` | Description masquee, espacements reduits |
| `src/components/settings/NotificationSettings.tsx` | Description masquee, espacements reduits |

