ALTER TABLE "attempts" ADD COLUMN "audio_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "call_events" ADD COLUMN "received_at" timestamp with time zone DEFAULT now() NOT NULL;