ALTER TABLE "attempts" ADD COLUMN "analysis_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "server_analysis" text;