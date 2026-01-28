

# Revenir au format Story (1080x1920)

## Objectif

Repasser l'image d'export du format carré (1080x1080) au format story vertical (1080x1920), plus adapte pour afficher un classement complet avec plus d'espace.

---

## Modifications techniques

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Modifier les dimensions dans `toJpeg`** (lignes 193-194)

```typescript
// AVANT
width: 1080,
height: 1080,

// APRES
width: 1080,
height: 1920,
```

**2. Modifier les dimensions du template HTML** (lignes 430-431)

```typescript
// AVANT
width: "1080px",
height: "1080px",

// APRES
width: "1080px",
height: "1920px",
```

**3. Ajuster le padding et les espacements** (ligne 433)

```typescript
// AVANT
padding: "30px",

// APRES
padding: "40px",
```

**4. Agrandir les tailles de police du header** (lignes 446-456)

```typescript
// Titre : 32px → 48px
fontSize: "48px"

// Sous-titre categorie : 18px → 24px
fontSize: "24px"

// Date : 16px → 20px
fontSize: "20px"

// marginBottom : 20px → 40px
marginBottom: "40px"
paddingBottom: "25px"
```

**5. Agrandir le tableau** (lignes 464-498)

```typescript
// En-tetes : 14px → 18px, padding 8px → 14px
fontSize: "18px", padding: "14px"

// Corps : 16px/13px → 20px/16px, padding 6px → 12px
fontSize: "20px" // position
fontSize: "18px" // coureur
fontSize: "16px" // equipe, manager
fontSize: "18px" // points
padding: "12px 14px"

// marginBottom : 20px → 40px
marginBottom: "40px"
```

**6. Agrandir la section maillots** (lignes 502-534)

```typescript
// Icones : 24px → 32px
fontSize: "32px"

// Texte label : 12px → 14px
// Texte nom : 14px → 18px
// Texte manager : 12px → 14px
// padding : 10px → 15px
// gap : 10px → 15px
```

**7. Ajuster le footer** (lignes 539-552)

```typescript
// bottom : 20px → 40px
// left/right : 30px → 40px
// fontSize : 18px → 24px
// paddingTop : 15px → 25px
```

**8. Mettre a jour le texte d'indication** (ligne 346)

```typescript
// AVANT
<p>Format: 1080 x 1080 (carre, optimal mobile)</p>

// APRES
<p>Format: 1080 x 1920 (story, ideal partage)</p>
```

---

## Comparaison

| Element | Carre (avant) | Story (apres) |
|---------|---------------|---------------|
| Dimensions | 1080 x 1080 | 1080 x 1920 |
| Ratio | 1:1 | 9:16 |
| Padding | 30px | 40px |
| Titre | 32px | 48px |
| Tableau corps | 13-16px | 16-20px |
| Maillots icones | 24px | 32px |
| Footer | 18px | 24px |

---

## Resultat attendu

```text
┌────────────────────────────┐
│                            │
│       AlUla Tour           │
│   2.pro • General • Etape 2│
│      31 janvier 2026       │
│ ────────────────────────── │ ← Ligne jaune
│                            │
│ #  │ Coureur    │ Equipe │ Manager │ Pts │
│ ────────────────────────────────────────── │
│ 🥇 │ MILAN      │ LID    │ Bubu    │ 150 │
│ 🥈 │ ACKERMANN  │ ISR    │ Fab     │ 120 │
│ 🥉 │ SKERL      │ ABC    │ Fab     │ 100 │
│  4 │ ...        │ ...    │ ...     │  80 │
│  5 │ ...        │ ...    │ ...     │  70 │
│  6 │ ...        │ ...    │ ...     │  60 │
│ ...│ ...        │ ...    │ ...     │ ... │
│ 15 │ ...        │ ...    │ ...     │  10 │
│                            │
│ ────────────────────────── │ ← Ligne jaune
│ 🟡 Leader      │ 🟢 Points   │
│    Coureur X   │    Coureur Y│
│    Manager A   │    Manager B│
│                            │
│ 🔴 Montagne    │ ⚪ Jeune    │
│    Coureur Z   │    Coureur W│
│    Manager C   │    Manager D│
│                            │
│ ────────────────────────── │
│         MPC 2026           │
│                            │
└────────────────────────────┘
```

Format vertical story optimise pour Instagram/WhatsApp stories avec plus d'espace pour le classement complet.

