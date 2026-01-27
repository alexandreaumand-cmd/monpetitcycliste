
# Condensation de la section Profil

## Objectif

Passer d'un layout vertical centré (avatar au milieu, champs en dessous) a un layout horizontal compact (avatar a gauche, champs a droite).

---

## Nouvelle structure proposee

```text
┌────────────────────────────────────────────────────────────┐
│ Profil                                                     │
│ Gerez vos informations personnelles                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐   Email: user@example.com                    │
│  │          │   Nom du manager: [_______________]          │
│  │  Avatar  │                                              │
│  │   80px   │   [Changer photo] [Supprimer]                │
│  └──────────┘                                              │
│                                                            │
│  [Mettre a jour le profil]                                 │
└────────────────────────────────────────────────────────────┘
```

---

## Modifications

### 1. AvatarUploader.tsx

- Reduire la taille de l'avatar de 128px a 80px
- Changer le layout de vertical (`flex-col items-center`) a horizontal/compact
- Supprimer le texte d'aide "JPG, PNG ou WEBP" (superflu)
- Rendre les boutons plus petits (icones seules)

### 2. AccountPage.tsx - Section Profil

Remplacer le layout actuel par un layout en grille :

```text
Avant (vertical) :
- Avatar centre
- Email (pleine largeur)
- Nom manager (pleine largeur)
- Bouton

Apres (horizontal) :
- Grille 2 colonnes sur desktop
- Colonne gauche : Avatar compact avec boutons
- Colonne droite : Email + Nom manager empiles
- Bouton en bas
```

---

## Code cible pour AccountPage.tsx

```tsx
<CardContent className="space-y-4">
  {/* Layout horizontal : Avatar + Champs */}
  <div className="flex flex-col sm:flex-row gap-6">
    {/* Avatar compact a gauche */}
    <AvatarUploader
      currentAvatarUrl={avatarUrl || undefined}
      managerName={manager?.nom || ""}
      userId={user.id}
      onAvatarChange={setAvatarUrl}
    />

    {/* Champs a droite */}
    <div className="flex-1 space-y-4">
      {/* Email */}
      <div className="space-y-1">
        <Label htmlFor="email">{t('profile.email')}</Label>
        <Input ... disabled className="bg-muted" />
      </div>

      {/* Nom du manager */}
      <div className="space-y-1">
        <Label htmlFor="nom_manager">{t('profile.managerName')}</Label>
        <Input ... />
      </div>
    </div>
  </div>

  <Button onClick={handleUpdateProfile} ...>
    {t('buttons.updateProfile')}
  </Button>
</CardContent>
```

---

## Code cible pour AvatarUploader.tsx

```tsx
return (
  <div className="flex flex-col items-center gap-2">
    <Avatar className="h-20 w-20">
      {displayUrl ? (
        <AvatarImage src={displayUrl} alt={managerName} />
      ) : null}
      <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
    </Avatar>

    <div className="flex gap-1">
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || deleting}
        size="sm"
        variant="ghost"
        className="h-8 px-2"
      >
        <Camera className="h-4 w-4" />
      </Button>

      {currentAvatarUrl && (
        <Button
          onClick={handleDeleteAvatar}
          disabled={uploading || deleting}
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>

    <input ref={fileInputRef} type="file" ... className="hidden" />
  </div>
);
```

---

## Fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/account/AvatarUploader.tsx` | Reduire taille (80px), boutons icones, supprimer texte aide |
| `src/pages/AccountPage.tsx` | Layout grille horizontal pour Avatar + champs, reduire espacement |

---

## Gain d'espace

- Avatar 80px au lieu de 128px : **-40%** hauteur
- Layout horizontal : **-50%** hauteur globale de la section
- Suppression texte superflu : **-20px**
