

# Corriger les cron jobs arena-recaps (mauvaise URL)

## Diagnostic

Les cron jobs `arena-daily-recap` (20h UTC) et `arena-weekly-recap` (dimanche 20h15 UTC) existent dans la base LIVE mais appellent l'URL d'un **ancien projet Supabase** (`oisfvryhpovwxaxqbmow`) au lieu du projet actuel (`khahpetvqjoyrwambaqn`).

C'est pourquoi les récaps ne s'affichent plus depuis un moment — ils sont envoyés dans le vide.

## Solution

Mettre à jour les deux cron jobs via SQL (outil d'insertion) pour pointer vers la bonne URL et la bonne clé :

### 1. Supprimer les anciens jobs

```sql
SELECT cron.unschedule('arena-daily-recap');
SELECT cron.unschedule('arena-weekly-recap');
```

### 2. Recréer avec la bonne URL

**Daily (20h UTC)** :
```sql
SELECT cron.schedule('arena-daily-recap', '0