-- 0009 numbered existing decisions in scan order: renumber them by decision time so "latest" keeps its meaning.
UPDATE "decisions" d SET "seq" = r.rn FROM (SELECT "id", row_number() OVER (ORDER BY "decided_at", "id") AS rn FROM "decisions") r WHERE d."id" = r."id";--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('decisions', 'seq'), coalesce((SELECT max("seq") FROM "decisions"), 0) + 1, false);
