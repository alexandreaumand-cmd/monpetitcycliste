-- Add bonus_scoreurs column to manager_bonus_points table
ALTER TABLE manager_bonus_points 
ADD COLUMN bonus_scoreurs integer NOT NULL DEFAULT 0;