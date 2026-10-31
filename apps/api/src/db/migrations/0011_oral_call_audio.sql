CREATE TABLE "call_events" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"who" text NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "audio_hash" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "audio_merged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "audio_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_events_attempt_id_at_index" ON "call_events" USING btree ("attempt_id","at");