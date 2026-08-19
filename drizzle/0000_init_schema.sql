CREATE TABLE "exercises" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exercises_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"user_id" uuid,
	"body_part" text NOT NULL,
	"equipment" text NOT NULL,
	"target" text NOT NULL,
	"instructions" text,
	"source" text DEFAULT 'built-in' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_days" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plan_days_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_exercises" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plan_exercises_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_day_id" integer NOT NULL,
	"exercise_name" text NOT NULL,
	"sets" integer NOT NULL,
	"reps" text NOT NULL,
	"rest_sec" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schedule_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"plan_day_id" integer,
	"label" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"workout_id" integer
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_sets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workout_id" integer NOT NULL,
	"exercise_name" text NOT NULL,
	"exercise_order" integer DEFAULT 0 NOT NULL,
	"set_number" integer NOT NULL,
	"weight_kg" real NOT NULL,
	"reps" integer NOT NULL,
	"is_pr" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
-- auth.users already exists (managed by Supabase) — not created here.
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_plan_day_id_plan_days_id_fk" FOREIGN KEY ("plan_day_id") REFERENCES "public"."plan_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_plan_day_id_plan_days_id_fk" FOREIGN KEY ("plan_day_id") REFERENCES "public"."plan_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_name_global_unique" ON "exercises" USING btree ("name") WHERE "exercises"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_name_user_unique" ON "exercises" USING btree ("name","user_id");