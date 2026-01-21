-- Step 2: Migrate existing data from "Porteur Général" to "Porteur Leader"
UPDATE race_results 
SET type_classement = 'Porteur Leader' 
WHERE type_classement = 'Porteur Général';

-- Update scoring_rules table if it uses this type
UPDATE scoring_rules 
SET type_classement = 'Porteur Leader' 
WHERE type_classement::text = 'Porteur Général';

-- Update scoring_rules_saisons table
UPDATE scoring_rules_saisons 
SET type_classement = 'Porteur Leader' 
WHERE type_classement::text = 'Porteur Général';

-- Update points_ledger if it uses this type
UPDATE points_ledger 
SET type_classement = 'Porteur Leader' 
WHERE type_classement::text = 'Porteur Général';

-- Update race_result_sets if it uses this type
UPDATE race_result_sets 
SET type_classement = 'Porteur Leader' 
WHERE type_classement::text = 'Porteur Général';