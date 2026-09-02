CREATE INDEX "body_measurements_user_id_date_idx" ON "body_measurements" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "plan_days_plan_id_idx" ON "plan_days" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_exercises_plan_day_id_idx" ON "plan_exercises" USING btree ("plan_day_id");--> statement-breakpoint
CREATE INDEX "plans_user_id_idx" ON "plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_user_id_date_idx" ON "schedule_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "schedule_entries_plan_day_id_idx" ON "schedule_entries" USING btree ("plan_day_id");--> statement-breakpoint
CREATE INDEX "workout_sets_workout_id_idx" ON "workout_sets" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "workouts_user_id_date_id_idx" ON "workouts" USING btree ("user_id","date","id");