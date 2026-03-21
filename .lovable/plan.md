
## Remplacer le champ Sujet par un select avec options prédéfinies

### Modifications

**`src/pages/ContactPage.tsx`** — Remplacer l'`Input` du sujet par un composant `Select` (shadcn) avec 5 options :
- Question sur le jeu
- Bug technique
- Suggestion
- Demande de partenariat
- Autre

**`src/i18n/locales/fr/home.json`** et **`en/home.json`** — Ajouter les traductions des 5 sujets et du placeholder du select dans la section `contact`.

### Détail technique
- Utiliser `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` de `@/components/ui/select`
- La valeur sélectionnée alimente `form.subject` comme avant
- Le placeholder devient "Choisissez un sujet"
- Le champ reste optionnel (pas de `required`)
