ALTER TABLE "markers" ADD COLUMN "source" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "markers" ADD COLUMN "discrepancy" boolean DEFAULT false NOT NULL;