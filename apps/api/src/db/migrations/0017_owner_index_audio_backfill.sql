CREATE INDEX "exams_owner_id_index" ON "exams" USING btree ("owner_id");--> statement-breakpoint
-- Merges given up by the previous version were marked merged with no audio; they read as "failed" now.
UPDATE "attempts" SET "audio_merged_at" = NULL WHERE "audio_hash" IS NULL AND "audio_tries" >= 3;
