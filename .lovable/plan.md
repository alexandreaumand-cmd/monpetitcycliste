

# Augmenter la taille des textes pour mobile

## Objectif

Augmenter les tailles de police de l'image d'export pour une meilleure lisibilite sur telephone.

---

## Modifications techniques

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Header - Augmenter les tailles** (lignes 446-456)

| Element | Avant | Apres |
|---------|-------|-------|
| Titre course | 48px | **56px** |
| Sous-titre (categorie) | 24px | **28px** |
| Date | 20px | **24px** |

**2. Tableau - En-tetes** (lignes 465-469)

| Element | Avant | Apres |
|---------|-------|-------|
| En-tetes colonnes | 18px | **22px** |
| Padding | 14px | **16px** |

**3. Tableau - Corps** (lignes 481-501)

| Element | Avant | Apres |
|---------|-------|-------|
| Position (#) | 20px | **24px** |
| Coureur nom | 18px | **22px** |
| Equipe | 16px | **20px** |
| Manager | 16px | **20px** |
| Points | 18px | **22px** |
| Padding cellules | 12px 14px | **14px 16px** |

**4. Section maillots** (lignes 529-541)

| Element | Avant | Apres |
|---------|-------|-------|
| Icone maillot | 32px | **40px** |
| Label (ex: "Leader") | 14px | **18px** |
| Nom coureur | 18px | **22px** |
| Nom manager | 14px | **18px** |
| Padding carte | 15px | **20px** |
| Gap entre cartes | 15px | **20px** |

**5. Footer** (ligne 559)

| Element | Avant | Apres |
|---------|-------|-------|
| Nom ligue | 24px | **28px** |

---

## Comparaison visuelle

```text
AVANT (tailles actuelles)        APRES (tailles augmentees)
─────────────────────────        ──────────────────────────
Titre: 48px                      Titre: 56px (+17%)
Sous-titre: 24px                 Sous-titre: 28px (+17%)
Tableau: 16-20px                 Tableau: 20-24px (+25%)
Maillots: 14-18px                Maillots: 18-22px (+28%)
```

---

## Resultat attendu

Textes plus grands et plus lisibles quand l'image est ouverte sur un telephone, notamment :
- Les noms des coureurs clairement visibles
- Les points faciles a lire
- Les porteurs de maillots bien identifies

