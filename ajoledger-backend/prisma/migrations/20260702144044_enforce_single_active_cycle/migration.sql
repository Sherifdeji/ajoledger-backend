CREATE UNIQUE INDEX "one_active_cycle_per_group" ON "savings_cycles"("group_id") WHERE "is_active" = true;
