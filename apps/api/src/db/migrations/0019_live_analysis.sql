CREATE TABLE "chunk_observations" (
	"attempt_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"observations" jsonb NOT NULL,
	CONSTRAINT "chunk_observations_attempt_id_hash_pk" PRIMARY KEY("attempt_id","hash")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "live_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chunk_observations" ADD CONSTRAINT "chunk_observations_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;