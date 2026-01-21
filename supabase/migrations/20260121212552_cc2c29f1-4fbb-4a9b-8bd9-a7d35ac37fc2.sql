-- Add 'Porteur General' (without accent) as a valid enum value
-- This provides backward compatibility for any cached clients
ALTER TYPE public.type_classement ADD VALUE IF NOT EXISTS 'Porteur General';