ALTER TABLE "cutting_orders" ADD COLUMN "sewing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD COLUMN "sewing_started_by" integer;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_started_by_users_id_fk" FOREIGN KEY ("sewing_started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_requires_verified" CHECK ("cutting_orders"."sewing_started_at" IS NULL OR "cutting_orders"."status" = 'VERIFIED');--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_start_attributed" CHECK (("cutting_orders"."sewing_started_at" IS NULL) = ("cutting_orders"."sewing_started_by" IS NULL));--> statement-breakpoint

-- Once sewing has started, the record of when and by whom is permanent.
CREATE FUNCTION cutting_orders_sewing_start_is_permanent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sewing_started_at IS NOT NULL AND (
    NEW.sewing_started_at, NEW.sewing_started_by
  ) IS DISTINCT FROM (
    OLD.sewing_started_at, OLD.sewing_started_by
  ) THEN
    RAISE EXCEPTION 'sewing has already started for cutting order % and its start record cannot be changed', OLD.order_no
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cutting_orders_sewing_start_is_permanent
  BEFORE UPDATE ON cutting_orders
  FOR EACH ROW EXECUTE FUNCTION cutting_orders_sewing_start_is_permanent();
