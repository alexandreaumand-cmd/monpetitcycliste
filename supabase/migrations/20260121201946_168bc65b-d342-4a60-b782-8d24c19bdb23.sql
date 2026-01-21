-- Step 1: Add new enum value for Porteur Leader (to replace Porteur Général and avoid accent issues)
ALTER TYPE type_classement ADD VALUE IF NOT EXISTS 'Porteur Leader';