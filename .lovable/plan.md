## Fix: Enable Leaked Password Protection (HIBP)

Enable Supabase's Have-I-Been-Pwned check so signups and password changes reject passwords known to be leaked.

### Change
- Call `configure_auth` with `password_hibp_enabled: true` (keep other settings unchanged: `disable_signup: false`, `external_anonymous_users_enabled: false`, `auto_confirm_email: false`).

### Follow-up
- Mark `SUPA_auth_leaked_password_protection` as fixed.

### Out of scope
Other open security findings.
