ALTER TABLE "cutting_orders" ADD COLUMN "sewing_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD COLUMN "sewing_completed_by" integer;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_completed_by_users_id_fk" FOREIGN KEY ("sewing_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_completion_attributed" CHECK (("cutting_orders"."sewing_completed_at" IS NULL) = ("cutting_orders"."sewing_completed_by" IS NULL));--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_completed_after_start" CHECK ("cutting_orders"."sewing_completed_at" IS NULL OR ("cutting_orders"."sewing_started_at" IS NOT NULL AND "cutting_orders"."sewing_completed_at" >= "cutting_orders"."sewing_started_at"));--> statement-breakpoint

-- Once a batch is marked as completed, the record of when and by whom is
-- permanent, in the same way as the record of when sewing started.
CREATE FUNCTION cutting_orders_sewing_completion_is_permanent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sewing_completed_at IS NOT NULL AND (
    NEW.sewing_completed_at, NEW.sewing_completed_by
  ) IS DISTINCT FROM (
    OLD.sewing_completed_at, OLD.sewing_completed_by
  ) THEN
    RAISE EXCEPTION 'sewing is already completed for cutting order % and its completion record cannot be changed', OLD.order_no
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cutting_orders_sewing_completion_is_permanent
  BEFORE UPDATE ON cutting_orders
  FOR EACH ROW EXECUTE FUNCTION cutting_orders_sewing_completion_is_permanent();
