## Objectif

Copier le template "Communication générale - La Bordure" depuis l'environnement TEST vers l'environnement LIVE, sachant que les données ne sont jamais synchronisées automatiquement entre les deux environnements.

## Constat

- **TEST** : 1 template présent (`Communication générale - La Bordure`, créé le 30/04/2026)
- **LIVE** : table `communication_templates` vide
- **Super-admin** : ton `user_id` (`47635252-a460-4a79-98f3-9b30896a47ad`) existe dans les deux environnements → on peut réutiliser le même `created_by`

## Procédure

### Étape 1 — Ouvrir Cloud View → Run SQL en mode Live

1. Ouvrir le panneau **Cloud**
2. Aller dans **Database → Run SQL** (ou "SQL Editor")
3. **Sélectionner l'environnement "Live"** dans le sélecteur en haut

### Étape 2 — Coller et exécuter la requête

```sql
INSERT INTO public.communication_templates (
  id,
  name,
  subject,
  body_html,
  created_by,
  created_at,
  updated_at
) VALUES (
  '40a87005-e8d5-4a68-b6bf-c7612a0f8cd6',
  'Communication générale - La Bordure',
  'Une nouvelle communication de La Bordure',
  $HTML$<div style="background-color:#F6F3ED;padding:24px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="background-color:#1B5E3B;padding:24px;text-align:center;">
      <img src="https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png" alt="La Bordure" width="120" style="display:block;margin:0 auto;" />
    </div>
    <div style="padding:28px 28px 8px;">
      <h1 style="font-size:22px;font-weight:bold;color:#1B5E3B;margin:0 0 16px;">Bonjour {{prenom}},</h1>
      <p style="font-size:15px;color:#2D3D32;line-height:1.6;margin:0 0 16px;">
        Nous avons une information importante à partager avec toi concernant <strong>La Bordure</strong>.
      </p>
      <p style="font-size:15px;color:#2D3D32;line-height:1.6;margin:0 0 16px;">
        <em>Remplace ce paragraphe par le contenu de ta communication. Tu peux ajouter du texte en gras, des liens, des listes, etc.</em>
      </p>
      <p style="font-size:15px;color:#2D3D32;line-height:1.6;margin:0 0 24px;">
        Pour toute question, n'hésite pas à répondre à cet email.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="https://labordure.app" style="background-color:#C8963A;color:#ffffff;font-size:15px;font-weight:bold;border-radius:12px;padding:14px 28px;text-decoration:none;display:inline-block;">
          Accéder à La Bordure
        </a>
      </div>
      <p style="font-size:14px;color:#2D3D32;line-height:1.6;margin:0 0 8px;">
        Sportivement,<br/>
        <strong>L'équipe La Bordure</strong>
      </p>
    </div>
    <div style="padding:16px 28px 24px;border-top:1px solid #EAE5DA;">
      <p style="font-size:12px;color:#8B8B8B;margin:0;line-height:1.5;">
        Tu reçois cet email car tu es inscrit sur La Bordure ({{email}}).
      </p>
    </div>
  </div>
</div>$HTML$,
  '47635252-a460-4a79-98f3-9b30896a47ad',
  now(),
  now()
);
```

> Note : on utilise `$HTML$ ... $HTML$` (dollar-quoting Postgres) au lieu de guillemets simples pour éviter d'avoir à échapper les apostrophes du HTML.

### Étape 3 — Vérifier

Toujours dans le SQL Editor en mode Live :

```sql
SELECT id, name, subject, created_at FROM public.communication_templates;
```

Tu devrais voir la ligne fraîchement insérée.

### Étape 4 — Tester dans l'app LIVE

Aller sur `https://labordure.app/dashboard/super-admin/communications` → onglet **Templates** : le template doit apparaître et être utilisable depuis l'onglet **Nouvel envoi**.

## Pour les futurs templates

À chaque nouveau template créé en TEST que tu veux retrouver en LIVE, il faudra refaire cette opération manuelle (ou bien créer le template directement en LIVE via l'UI). Si tu veux à terme un mécanisme d'export/import intégré dans l'UI super-admin, c'est faisable mais hors périmètre de ce ticket.