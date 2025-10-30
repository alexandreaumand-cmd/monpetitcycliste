-- Disable auto-open-scheduled-auctions cron job
SELECT cron.unschedule('auto-open-scheduled-auctions');