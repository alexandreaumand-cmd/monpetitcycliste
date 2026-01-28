

# Simplifier le design et adapter la taille pour mobile

## Objectif

Combiner les deux modifications demandées :
1. **Supprimer le fond gradient** → Fond blanc épuré
2. **Redimensionner l'image** → Format carré 1080x1080 pour mobile

---

## Modifications techniques

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Modifier les dimensions (lignes 193-194 et 430-431)**

```typescript
// toJpeg options
width: 1080,
height: 1080,  // au lieu de 1920
backgroundColor: "#ffffff",  // au lieu de #000000

// Template HTML
width: "1080px",
height: "1080px",  // au lieu de 1920px
background: "#ffffff",  // au lieu du gradient
padding: "30px",  // au lieu de 40px
```

**2. Header compact (lignes 438-453)**

```typescript
<div style={{ 
  textAlign: "center", 
  marginBottom: "20px",
  borderBottom: "3px solid #FFD500",
  paddingBottom: "15px"
}}>
  <h1 style={{ fontSize: "32px", margin: "0 0 8px 0", fontWeight: "bold", color: "#1a1a1a" }}>
    {course.course_nom}
  </h1>
  <p style={{ fontSize: "18px", color: "#6b7280", margin: "4px 0" }}>
    {course.categorie} • {typeClassement}{etapeNumero && ` • Étape ${etapeNumero}`}
  </p>
  <p style={{ fontSize: "16px", color: "#9ca3af" }}>
    {format(...)}
  </p>
</div>
```

**3. Tableau épuré avec tailles réduites (lignes 456-509)**

- En-têtes : 14px, padding 8px
- Corps : 13px, padding 6px
- Garder médailles 🥇🥈🥉
- Alternance de fond : blanc / gris très clair

**4. Section maillots compacte (lignes 514-545)**

- Icônes : 24px
- Texte : 12-14px
- Grid 2 colonnes

**5. Footer simplifié (lignes 551-557)**

```typescript
<div style={{ 
  position: "absolute",
  bottom: "20px",
  left: "30px",
  right: "30px",
  textAlign: "center",
  borderTop: "1px solid #e5e7eb",
  paddingTop: "15px"
}}>
  <p style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>
    {leagueName || "Mon Petit Cycliste"}
  </p>
</div>
```

**6. Mettre à jour le texte du format (ligne 346)**

```typescript
<p>Format: 1080 x 1080 (carré, optimal mobile)</p>
```

---

## Comparaison

| Élément | Avant | Après |
|---------|-------|-------|
| Dimensions | 1080 x 1920 | 1080 x 1080 |
| Fond | Gradient noir→jaune | Blanc |
| Titre | 48px | 32px |
| Tableau | 18-20px | 13-14px |
| Padding | 40px | 30px |

---

## Résultat attendu

```text
┌────────────────────────────┐
│      AlUla Tour            │
│  2.pro • Etape • Étape 2   │
│     31 janvier 2026        │
├────────────────────────────┤ ← Ligne jaune
│ # │Coureur    │Équipe│Mgr│Pts│
│ 🥇│MILAN      │LID   │Bubu│150│
│ 🥈│ACKERMANN  │ISR   │Fab │120│
│ 🥉│SKERL      │ABC   │Fab │100│
│ 4 │...        │...   │... │ 80│
├────────────────────────────┤ ← Ligne jaune
│🟡Leader 🟢Pts 🔴Mont ⚪Jeune│
├────────────────────────────┤
│        MPC 2026            │
└────────────────────────────┘
```

Image carrée, fond blanc, lisible sur mobile sans scroll.

