-- Exams created before oral exams existed are written exams.
UPDATE "exams" SET "profile" = "profile" || '{"mode":"written"}'::jsonb WHERE NOT ("profile" ? 'mode');
