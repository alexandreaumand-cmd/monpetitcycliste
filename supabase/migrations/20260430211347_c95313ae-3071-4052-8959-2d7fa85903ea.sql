-- Garantir que les queues pgmq email existent (idempotent).
-- Sur TEST elles existent déjà — no-op. Sur LIVE, au publish, elles seront créées.
-- Cause : le cron process-email-queue référence q_auth_emails qui n'existe pas en LIVE,
-- ce qui fait planter le cron toutes les 5s et bloque tous les emails en pending.

DO $$
BEGIN
  -- Queue principale transactionnelle (devrait exister mais on sécurise)
  IF to_regclass('pgmq.q_transactional_emails') IS NULL THEN
    PERFORM pgmq.create('transactional_emails');
  END IF;

  -- Queue auth — manquante en LIVE, référencée par le cron
  IF to_regclass('pgmq.q_auth_emails') IS NULL THEN
    PERFORM pgmq.create('auth_emails');
  END IF;

  -- DLQ transactionnelle — manquante en LIVE
  IF to_regclass('pgmq.q_transactional_emails_dlq') IS NULL THEN
    PERFORM pgmq.create('transactional_emails_dlq');
  END IF;
END $$;