## Objectif

Permettre au super-admin d'envoyer une communication générale par email à un ou plusieurs utilisateurs, à partir d'une bibliothèque de templates réutilisables, avec édition à la volée et historique des envois.

## Périmètre

- Accès : super-admins uniquement
- Destinataires : sélection multiple parmi tous les inscrits, avec recherche et filtres (ligue, rôle, statut)
- Templates : bibliothèque persistée en base, créables/éditables/supprimables, pré-remplis dans l'éditeur d'envoi
- Envoi : un email par destinataire via la file d'attente existante (`enqueue_email`), avec log et lien de désinscription

## UX — Nouvelle page "Communications" dans le super-admin

Ajout d'une entrée de menu dans le super-admin (à côté de "Utilisateurs", "Ligues", etc.) → page `SuperAdminCommunicationsPage` avec deux onglets :

### Onglet 1 — Templates

- Liste des templates existants (nom, sujet, dernière modification)
- Bouton "Nouveau template" → dialog avec : nom interne, sujet, corps en éditeur riche (gras, italique, liens, listes, sauts de ligne)
- Variables disponibles affichées sous l'éditeur : `{{prenom}}`, `{{email}}`, `{{nom_manager}}` (insérables d'un clic)
- Actions par template : Éditer, Dupliquer, Supprimer, "Utiliser pour envoyer" (bascule sur l'onglet 2 avec template pré-sélectionné)

### Onglet 2 — Nouvel envoi

Layout en 3 étapes verticales :

**1. Choix du template**
- Dropdown des templates disponibles + bouton "Sans template (vide)"

**2. Composition** (pré-remplie depuis le template, modifiable)
- Champ Sujet
- Éditeur riche pour le corps
- Aperçu en direct (rendu HTML avec variables substituées par des valeurs d'exemple)

**3. Destinataires**
- Filtres en haut : recherche texte, select Ligue, select Rôle (membre / admin de ligue / superadmin), select Statut (confirmé / non confirmé / banni)
- Tableau paginé : checkbox + email + nom manager + ligues + statut
- Boutons : "Tout sélectionner (filtre courant)", "Tout désélectionner"
- Compteur "X destinataires sélectionnés" toujours visible
- Bouton final "Envoyer" (désactivé si 0 destinataire ou sujet/corps vide) → dialog de confirmation rappelant le nombre d'emails

### Sous-onglet "Historique" (dans l'onglet Nouvel envoi ou en 3e onglet)

- Liste des envois passés (date, template utilisé, sujet, nombre de destinataires, statuts agrégés : envoyés/échoués/en attente)
- Clic sur une ligne → détail destinataire par destinataire (statut individuel depuis `email_send_log`)

## Détails techniques

### Base de données (migration)

Deux nouvelles tables :

```sql
-- Bibliothèque de templates
CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lot d'envoi (regroupe tous les emails d'un même envoi)
CREATE TABLE public.communication_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  recipient_count integer NOT NULL,
  sent_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS : `is_superadmin()` requis pour `ALL` sur les deux tables. L'historique destinataire par destinataire est récupéré en joignant `communication_batches` avec `email_send_log` via `metadata->>'batch_id'`.

### Edge Function : `send-communication-email`

- Vérifie JWT + `is_superadmin()` côté serveur (sécurité critique)
- Reçoit : `{ subject, body_html, template_id?, recipient_user_ids: uuid[] }`
- Validation Zod : sujet 1-300 chars, corps 1-100k chars, max 500 destinataires par envoi
- Crée un `communication_batches`
- Pour chaque destinataire : récupère email + prénom/nom_manager, substitue les variables `{{...}}`, ajoute le lien de désinscription, appelle `enqueue_email` avec `metadata = { batch_id, template_name: 'communication_general' }`
- Renvoie le `batch_id` et le nombre d'emails enfilés

L'envoi réel est ensuite traité par la fonction existante `process-email-queue` (cron). Aucun changement nécessaire côté infra email.

### Edge Function : `admin-communication-recipients`

Liste paginée des utilisateurs candidats avec filtres (ligue, rôle, statut). Réutilise la logique d'`admin-users-list` en l'adaptant pour ne retourner que les champs nécessaires (id, email, nom manager, ligues, statut). Restreinte aux superadmins.

### Frontend

Nouveaux fichiers :

- `src/pages/admin/SuperAdminCommunicationsPage.tsx` — page principale avec onglets
- `src/components/admin/communications/TemplatesList.tsx` — liste + CRUD templates
- `src/components/admin/communications/TemplateEditorDialog.tsx` — dialog création/édition
- `src/components/admin/communications/RichTextEditor.tsx` — wrapper léger autour de Tiptap (déjà disponible si présent, sinon textarea + barre d'outils minimale)
- `src/components/admin/communications/RecipientsPicker.tsx` — tableau filtrable avec sélection multiple
- `src/components/admin/communications/SendCommunicationForm.tsx` — assemble template + composition + destinataires + envoi
- `src/components/admin/communications/CommunicationHistoryList.tsx` — historique des envois
- `src/hooks/useCommunicationTemplates.ts` — CRUD templates
- `src/hooks/useCommunicationRecipients.ts` — chargement liste utilisateurs filtrée

Modifications :

- Ajout de la route `/admin/communications` et de l'entrée de menu dans la nav super-admin
- Réutilisation des composants UI existants (Card, Dialog, Table, Checkbox, Select, Tabs, Button)

### Sécurité

- Toutes les opérations d'envoi passent par edge function avec validation `is_superadmin()` côté serveur
- Validation Zod stricte des inputs
- Sanitisation du HTML avant envoi (DOMPurify ou allow-list de balises)
- Plafond de 500 destinataires par envoi pour éviter l'abus
- Lien de désinscription automatiquement injecté en pied d'email (utilise `email_unsubscribe_tokens`)
- Respect de la table de désinscription : exclusion des emails ayant un token `used_at` non nul

### Hors périmètre (à confirmer si tu en veux plus tard)

- Programmation d'envoi à une date future
- Templates par langue
- Pièces jointes
- Statistiques d'ouverture / clics
- Envoi de tests à soi-même avant l'envoi réel (pourrait être ajouté facilement si souhaité)
