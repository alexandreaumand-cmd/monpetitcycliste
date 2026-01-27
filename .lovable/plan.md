

# Remplacer le badge "NEW" par un trait discret

## Problème identifié
Le badge "NEW" jaune avec bordure noire est trop voyant dans la colonne évolution du classement (ligne 311 de `ManagerStandings.tsx`).

## Solution proposée
Remplacer le badge par un simple trait horizontal discret, identique au tiret utilisé pour "pas de changement" (—).

## Fichier à modifier

**`src/components/rankings/ManagerStandings.tsx`** - ligne 311

### Changement

| Avant | Après |
|-------|-------|
| `<Badge className="bg-[#FFD500] text-black border-2 border-black text-xs font-bold">NEW</Badge>` | `<span className="text-xs text-muted-foreground">—</span>` |

### Résultat
- Un simple tiret gris discret, identique au style déjà utilisé pour les managers sans évolution
- Cohérence visuelle avec le reste du tableau
- Fonctionne sur mobile et desktop

