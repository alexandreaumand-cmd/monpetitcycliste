# Améliorations UX mobile : navigation unifiée + fluidité

Deux problèmes remontés par l'utilisateur :
1. **Navigation confuse** : entre la barre du bas (6 boutons) et le menu hamburger en haut à gauche (5 sections, ~14 entrées), il est difficile de mémoriser où trouver quoi — d'autant que certaines entrées sont dupliquées (Classement, Mon Équipe, Startlist, Résultats, Live, Arène présents des deux côtés).
2. **Page rafraîchie systématiquement au retour arrière** : ouvrir une fiche coureur ou faire une enchère puis revenir relance des refetchs et perd la position de scroll → friction.

---

## Partie 1 — Unifier toute la navigation dans la barre du bas

**Décision** : la barre du bas devient la **seule source de navigation principale**. Le tiroir hamburger est supprimé (ou réduit à un mini-panneau "compte" déclenché depuis l'avatar).

### Nouvelle barre du bas mobile

5 emplacements visibles + 1 bouton "Plus" qui ouvre une bottom sheet pour les destinations secondaires :

```text
[Classement] [Équipe] [Startlist] [Live] [Plus ⋯]
```

Pourquoi ces 4 + Plus :
- ce sont les pages consultées quotidiennement (vu la fréquence d'utilisation actuelle dans `MobileBottomBar`) ;
- les autres (Courses, Résultats, Statistiques, Arène, Enchères, Compte, Admin, Déconnexion) passent dans la feuille "Plus".

### Bottom sheet "Plus"

Ouverte via le bouton ⋯ de la barre du bas. Contenu organisé en sections claires, exactement comme le tiroir actuel mais accessible **du même endroit** que le reste :

```text
Compétition
  • Enchères
  • Courses
  • Résultats
  • Arène

Analyse
  • Statistiques

Profil
  • Mon compte
  • Notifications
  • Déconnexion

Administration (si admin)
  • Admin
```

Avantages :
- une seule "carte mentale" : tout part du bas ;
- le header mobile devient plus calme (on garde uniquement le sélecteur de ligue + cloche notifications, on retire le bouton hamburger) ;
- plus de duplication entre les deux menus.

### Header mobile simplifié

`MobileLayout.tsx` : retirer le bouton `Menu`, garder logo + sélecteur de ligue + `NotificationCenter`. L'avatar/profil reste accessible via "Plus → Mon compte".

---

## Partie 2 — Préserver scroll et état au retour arrière

### Diagnostic des causes

1. **`ScrollToTop`** (`src/components/shared/ScrollToTop.tsx`) force `window.scrollTo(0,0)` à **chaque** changement de pathname, **y compris lors d'un retour arrière** → le scroll est perdu même quand le navigateur l'aurait restauré.
2. Les pages utilisent `useState` local pour les filtres / onglets / recherche → un démontage/remontage (navigation) repart de zéro.
3. `staleTime` global est déjà à 5 min, donc le cache React Query est OK ; le problème ressenti vient surtout du **scroll** et de la **perte d'état UI**.

### Solution

**a) Restauration de scroll intelligente**
- Modifier `ScrollToTop` : ne **pas** scroller en haut si la navigation est de type `POP` (= back/forward du navigateur). Utiliser `useNavigationType()` de react-router-dom.
- Pour les routes principales (dashboard), mémoriser la position de scroll dans une `Map<pathname, scrollY>` au démontage et la restaurer au remontage si `POP`.

**b) Persistance de l'état UI des pages clés**
Sauvegarder dans `sessionStorage` (clé par page) :
- onglet actif,
- requête de recherche,
- filtres sélectionnés,
- onglet ouvert dans les enchères (`AuctionTabs`).

Cibles prioritaires :
- `AuctionPageMobile` : `searchQuery`, `selectedTeams`, `selectedCotes`, `selectedCategories`, `selectedCourses`, `sortOrder`, onglet actif.
- `Startlist.mobile`, `ResultsPage.mobile`, `Rankings.mobile` : onglet/filtres principaux.

Implémenté via un petit hook réutilisable `usePersistentState(key, defaultValue)` qui se comporte comme `useState` + lecture/écriture `sessionStorage`.

**c) Pas de refetch superflu après une action locale**
- Vérifier que les mutations d'enchères mettent à jour le cache React Query via `setQueryData` au lieu de `invalidateQueries` quand c'est possible — pour éviter un spinner visible au retour de la fiche coureur.
- Sur les pages mobiles, ajouter `placeholderData: keepPreviousData` aux requêtes qui paginent ou se rafraîchissent souvent, pour conserver l'UI pendant la revalidation.

---

## Fichiers concernés

**Navigation** :
- `src/components/mobile/MobileBottomBar.tsx` — réduire à 4 entrées + bouton "Plus".
- `src/components/mobile/MobileMoreSheet.tsx` — **nouveau** composant : bottom sheet listant toutes les destinations secondaires.
- `src/components/mobile/MobileLayout.tsx` — retirer le bouton hamburger et le `MobileDrawer`.
- `src/components/mobile/MobileDrawer.tsx` — supprimé (contenu déplacé dans `MobileMoreSheet`).

**Fluidité** :
- `src/components/shared/ScrollToTop.tsx` — détection `POP` + mémoire de scroll.
- `src/hooks/usePersistentState.ts` — **nouveau** hook (sessionStorage).
- `src/components/auction/v2/AuctionPageMobile.tsx` — basculer les `useState` de filtres/recherche/onglet sur `usePersistentState`.
- `src/pages/Startlist.mobile.tsx`, `src/pages/ResultsPage.mobile.tsx`, `src/pages/Rankings.mobile.tsx` — idem pour leurs onglets/filtres principaux.

---

## Notes pour validation visuelle

- Tester sur viewport 390×844 (iPhone) : la barre du bas doit tenir confortablement avec 5 boutons (4 + ⋯).
- Vérifier que la safe-area iOS est respectée pour la bottom sheet "Plus".
- Tester le retour arrière depuis la liste des enchères vers une fiche puis retour : scroll, recherche et filtres doivent être préservés.
