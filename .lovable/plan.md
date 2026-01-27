
# Agrandissement des avatars manager

## Modifications demandées

| Emplacement | Actuel | Nouveau |
|-------------|--------|---------|
| Fun Awards (RankingsKPIs) | `h-6 w-6` (24px) | `h-8 w-8` (32px) |
| Comparaison (ManagerComparison) | `h-6 w-6` (24px) | `h-16 w-16` (64px) |
| Sheet Détail (ManagerBreakdown) | `h-8 w-8` (32px) | `h-16 w-16` (64px) |

---

## Fichiers à modifier

### 1. RankingsKPIs.tsx
- Changer `h-6 w-6` → `h-8 w-8` sur les Avatar (2 occurrences : mobile et desktop)

### 2. ManagerComparison.tsx  
- Changer `h-6 w-6` → `h-16 w-16` sur les Avatar (2 occurrences : Manager A et Manager B)

### 3. ManagerBreakdown.tsx
- Changer `h-8 w-8` → `h-16 w-16` sur l'Avatar du header

---

## Résumé

3 fichiers, changements simples de classes Tailwind.
