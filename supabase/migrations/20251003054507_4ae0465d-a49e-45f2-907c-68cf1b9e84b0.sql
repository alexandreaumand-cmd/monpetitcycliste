
-- Clean the race_results table to remove old data without manager_id and points
DELETE FROM race_results;

-- Also clean the points_ledger table since it depends on race_results
DELETE FROM points_ledger;
