
# Ajout des boutons "Courses du jour" sous le calendrier mobile

## Objectif

Ajouter une section sous le calendrier mobile avec un titre "Aujourd'hui" et un bouton par course se déroulant ce jour.

---

## Aperçu visuel

```text
┌─────────────────────────────────────────┐
│           Janvier 2026                  │
│   [< ]      Aujourd'hui      [ >]       │
├─────────────────────────────────────────┤
│  L   M   M   J   V   S   D              │
│ ...                                     │
│ 26  27● 28  29  30  31                  │
├─────────────────────────────────────────┤
│  ● WorldTour  ● ProSeries  ● .1  ...    │
└─────────────────────────────────────────┘

        ⬇️ NOUVELLE SECTION ⬇️

  Aujourd'hui                    ← Titre unique
┌─────────────────────────────────────────┐
│  Volta ao Algarve              ✓        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  AlUla Tour                             │
└─────────────────────────────────────────┘
```

---

## Modifications

### Fichier : `src/components/startlist/StartlistCalendarMobile.tsx`

#### 1. Calculer les courses du jour

Ajouter un `useMemo` pour filtrer les courses d'aujourd'hui :

```typescript
const todayCourses = useMemo(() => {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  return coursesByDay.get(todayKey) || [];
}, [coursesByDay]);
```

#### 2. Ajouter la section après la légende

```tsx
{/* Today's races - quick access */}
{todayCourses.length > 0 && (
  <div className="space-y-2 mt-4">
    <h4 className="text-sm font-medium text-muted-foreground">Aujourd'hui</h4>
    {todayCourses.map((course) => {
      const isValidated = isPcsValidated(course.id);
      return (
        <button
          key={course.id}
          onClick={() => onSelectRace(course)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="font-medium truncate flex-1">{course.nom}</span>
          {isValidated && (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          )}
        </button>
      );
    })}
  </div>
)}
```

---

## Résumé

| Élément | Description |
|---------|-------------|
| Titre | "Aujourd'hui" affiché une seule fois |
| Boutons | Un par course, avec le nom uniquement |
| Validation | Icône verte si startlist validée |
| Visibilité | Section masquée si aucune course aujourd'hui |

