
# Accordeon pour les equipes des managers - Startlist Mobile

## Objectif

Transformer l'affichage des managers dans la vue startlist mobile en un systeme d'accordeon :
- **Replie par defaut** : Affiche une vignette compacte avec les infos cles
- **Deplie au clic** : Revele tous les coureurs du manager
- **Equipe perso depliee** : L'accordeon de l'utilisateur connecte est ouvert par defaut

---

## Apercu visuel

### Etat replie (defaut)

```text
┌────────────────────────────────────────────────────────────┐
│ [Maillot]  Jean-Pierre Martin        3 coureurs      ▼    │
│            Team Cyclisme                                   │
│            ★★★★☆  Phase: #2  CG: #5                        │
└────────────────────────────────────────────────────────────┘
```

### Etat deplie (au clic)

```text
┌────────────────────────────────────────────────────────────┐
│ [Maillot]  Jean-Pierre Martin        3 coureurs      ▲    │
│            Team Cyclisme                                   │
│            ★★★★☆  Phase: #2  CG: #5                        │
├────────────────────────────────────────────────────────────┤
│  • Tadej Pogacar                                          │
│  • Jonas Vingegaard                                        │
│  • Primoz Roglic                                           │
└────────────────────────────────────────────────────────────┘
```

---

## Modifications techniques

### Fichier : `src/pages/Startlist.mobile.tsx`

#### 1. Ajouter un hook pour recuperer le manager connecte

```tsx
// Apres la ligne 62, ajouter une query pour l'ID du manager courant
const { data: currentUserManagerId } = useQuery({
  queryKey: ["current-user-manager"],
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: manager } = await supabase
      .from("managers")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    return manager?.id || null;
  },
});
```

#### 2. Initialiser l'accordeon avec l'equipe de l'utilisateur depliee

Modifier l'effet pour pre-ouvrir l'accordeon du manager connecte :

```tsx
// Apres le chargement des donnees startlist, ouvrir l'accordeon du user
useEffect(() => {
  if (startlistViewData?.managers && currentUserManagerId) {
    const userManager = startlistViewData.managers.find(
      (m: any) => m.manager_id === currentUserManagerId
    );
    if (userManager) {
      setExpandedManagers(new Set([currentUserManagerId]));
    }
  }
}, [startlistViewData, currentUserManagerId]);
```

#### 3. Importer le composant Accordion

```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
```

#### 4. Remplacer l'affichage des managers (lignes 559-636)

Transformer le mapping des managers pour utiliser un Accordion :

```tsx
{/* Managers */}
<div>
  <h3 className="text-lg font-semibold mb-3">{t('startlist.managersAtStart')}</h3>
  <Accordion 
    type="multiple" 
    value={Array.from(expandedManagers)}
    onValueChange={(values) => setExpandedManagers(new Set(values))}
    className="space-y-2"
  >
    {startlistViewData.managers.map((manager: any) => {
      const sortedStarters = [...manager.starters].sort(
        (a: any, b: any) => (b.cote || 0) - (a.cote || 0)
      );

      return (
        <AccordionItem
          key={manager.manager_id}
          value={manager.manager_id}
          className="border rounded-2xl px-3 bg-card"
        >
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-3 w-full">
              {/* Maillot */}
              {manager.jersey_image_url ? (
                <img 
                  src={manager.jersey_image_url} 
                  alt="Maillot" 
                  className="h-12 w-12 object-contain flex-shrink-0"
                />
              ) : (
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10">
                    {manager.manager_nom.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}
              
              {/* Infos manager */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">
                    {manager.manager_nom}
                  </span>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {manager.starters_count} {t('startlist.riders')}
                  </Badge>
                </div>
                
                {/* Equipe (sponsor) si disponible */}
                {manager.sponsor && (
                  <p className="text-xs text-muted-foreground truncate">
                    {manager.sponsor}
                  </p>
                )}
                
                {/* Etoiles + Classements */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <ManagerStars 
                    avgStars={manager.avg_stars} 
                    votes={manager.votes} 
                    showVotes={manager.votes > 1} 
                  />
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Ph: #{manager.rank_phase || "-"}</span>
                    <span>CG: #{manager.rank_total || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          
          <AccordionContent>
            <div className="space-y-1.5 pt-2">
              {sortedStarters.map((starter: any) => (
                <div 
                  key={starter.coureur_id} 
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                >
                  <span className="font-medium truncate">{starter.nom}</span>
                  {starter.equipe && (
                    <span className="text-xs text-muted-foreground truncate ml-2">
                      {starter.equipe}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      );
    })}
  </Accordion>
</div>
```

---

## Resume des changements

| Element | Modification |
|---------|--------------|
| Import | Ajouter `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| Hook | Nouvelle query `current-user-manager` pour ID du manager connecte |
| useEffect | Pre-ouvrir l'accordeon du manager connecte au chargement |
| Section Managers | Remplacer `MobileCard` par `Accordion` avec vignettes compactes |

---

## Comportement attendu

1. **Chargement** : Tous les accordeons sont replies SAUF celui du manager connecte
2. **Clic sur vignette** : Deplie/replie l'accordeon correspondant
3. **Multi-selection** : Plusieurs accordeons peuvent etre ouverts simultanement (`type="multiple"`)
4. **Infos visibles** : Maillot, Nom, Equipe, Nb coureurs, Etoiles, Position Phase, Position CG
