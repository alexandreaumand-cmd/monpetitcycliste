-- Reassign all courses to Phase 3
UPDATE courses 
SET phase_id = '4fe99c4c-fa1e-48d4-ae05-d411ed47a897' 
WHERE phase_id IS DISTINCT FROM '4fe99c4c-fa1e-48d4-ae05-d411ed47a897';