CREATE TABLE "exam_preloads" (
	"exam_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"hmac_key_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_preloads_exam_id_user_id_pk" PRIMARY KEY("exam_id","user_id"),
	CONSTRAINT "exam_preloads_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "start_code_enc" text;--> statement-breakpoint
ALTER TABLE "exam_preloads" ADD CONSTRAINT "exam_preloads_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_preloads" ADD CONSTRAINT "exam_preloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;