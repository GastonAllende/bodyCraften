CREATE TABLE "body_measurements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "body_measurements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"height_cm" real,
	"weight_kg" real,
	"waist_cm" real,
	"chest_cm" real,
	"thigh_cm" real,
	"hip_cm" real,
	"photo_path" text,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;