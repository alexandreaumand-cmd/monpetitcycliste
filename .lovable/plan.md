
# Fix: Parsing HTML des startlists PCS

## Probleme identifie

Le HTML PCS est **entierement minifie** (tout sur une seule ligne de ~44k caracteres). La structure reelle est :

```text
<ul class="startlist_v4">
  <li>                          <-- equipe (outer)
    <a class="team">...</a>
    <ul>
      <li class=" ">            <-- coureur (inner, imbrique)
        <a href="/rider/...">NOM</a>
      </li>
    </ul>
  </li>
</ul>
```

La regex `/<li[^>]*>[\s\S]*?<\/li>/gi` ne fonctionne pas correctement avec ces `<li>` imbriques sur une seule ligne. Le lazy matching decoupe mal les blocs, et aucun coureur n'est extrait.

## Solution

Simplifier `parseStartlistHtml` pour utiliser directement l'approche sequentielle (`parseStartlistByTeamAndRider`) qui scanne les liens `<a class="team">` et `<a href="/rider/...">` dans l'ordre. Cette methode est deja codee en fallback mais n'est jamais atteinte car le regex `<li>` retourne des blocs (mal formes).

## Changements

### Fichier : `supabase/functions/startlist-tracker/index.ts`

**`parseStartlistHtml`** : Supprimer la logique de split par blocs `<li>` et appeler directement `parseStartlistByTeamAndRider(section)` apres avoir trouve la section `startlist_v4`. Cela donne :

1. Trouver `class="startlist_v4"` dans le HTML
2. Extraire la section depuis ce point
3. Scanner sequentiellement les liens team et rider (sans decoupe par `<li>`)
4. Garder le fallback global si `startlist_v4` n'est pas present

**Ajouter du logging** dans `parseStartlistByTeamAndRider` pour tracer le nombre de teams et riders detectes.

## Detail technique

La fonction `parseStartlistByTeamAndRider` parcourt le HTML lineairement avec un seul regex combine :
- Quand elle rencontre `<a class="team">` : elle met a jour le nom de l'equipe courante
- Quand elle rencontre `<a href="/rider/...">` : elle ajoute le coureur avec l'equipe courante

Cette approche est insensible a l'imbrication des `<li>` et fonctionne sur du HTML minifie.

## Impact

- Aucun changement de comportement visible cote UI
- Parsing deterministe et robuste sur HTML minifie
- Redeploy automatique de la fonction
