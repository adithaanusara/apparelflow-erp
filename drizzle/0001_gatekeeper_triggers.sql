-- Database-level backstop for the gatekeeper rules. The API enforces all of
-- these first; the triggers make them hold even for a query that bypasses the
-- API (a bug, a script, a manual UPDATE).

-- 1. The audit trail is append-only: rows can be inserted, never changed.
CREATE FUNCTION verification_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'verification_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER verification_logs_append_only
  BEFORE UPDATE OR DELETE ON verification_logs
  FOR EACH ROW EXECUTE FUNCTION verification_logs_append_only();
--> statement-breakpoint
CREATE TRIGGER verification_logs_no_truncate
  BEFORE TRUNCATE ON verification_logs
  FOR EACH STATEMENT EXECUTE FUNCTION verification_logs_append_only();
--> statement-breakpoint

-- 2. Orders follow the state machine, and the hard stop holds in the database:
--    an order cannot become VERIFIED while any component is uncounted or short.
--    A VERIFIED order's batch data is frozen and it cannot be deleted.
CREATE FUNCTION cutting_orders_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'CUTTING_IN_PROGRESS' THEN
      RAISE EXCEPTION 'a new cutting order must start as CUTTING_IN_PROGRESS, not %', NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'VERIFIED' THEN
      RAISE EXCEPTION 'cutting order % is VERIFIED and cannot be deleted', OLD.order_no
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'CUTTING_IN_PROGRESS' AND NEW.status = 'PENDING_VERIFICATION')
    OR (OLD.status = 'PENDING_VERIFICATION' AND NEW.status IN ('VERIFIED', 'REJECTED'))
    OR (OLD.status = 'REJECTED' AND NEW.status = 'PENDING_VERIFICATION')
  ) THEN
    RAISE EXCEPTION 'cutting order % cannot move from % to %', OLD.order_no, OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'VERIFIED' AND OLD.status <> 'VERIFIED' AND (
    NOT EXISTS (SELECT 1 FROM verification_items WHERE order_id = NEW.id)
    OR EXISTS (
      SELECT 1 FROM verification_items
      WHERE order_id = NEW.id
        AND (actual_qty IS NULL OR actual_qty < expected_qty)
    )
  ) THEN
    RAISE EXCEPTION 'cutting order % cannot be VERIFIED: a component is uncounted or short', OLD.order_no
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'VERIFIED' AND (
    NEW.id, NEW.order_no, NEW.recipe_id, NEW.target_qty, NEW.fabric_roll_id,
    NEW.actual_fabric_yds, NEW.created_by, NEW.created_at
  ) IS DISTINCT FROM (
    OLD.id, OLD.order_no, OLD.recipe_id, OLD.target_qty, OLD.fabric_roll_id,
    OLD.actual_fabric_yds, OLD.created_by, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'cutting order % is VERIFIED and its batch data is immutable', OLD.order_no
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cutting_orders_guard
  BEFORE INSERT OR UPDATE OR DELETE ON cutting_orders
  FOR EACH ROW EXECUTE FUNCTION cutting_orders_guard();
--> statement-breakpoint

-- 3. The component counts of a VERIFIED order are part of the audit record:
--    they cannot be added to, changed or removed.
CREATE FUNCTION verification_items_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  item_order_id integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    item_order_id := NEW.order_id;
  ELSE
    item_order_id := OLD.order_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM cutting_orders
    WHERE id = item_order_id AND status = 'VERIFIED'
  ) OR (
    TG_OP = 'UPDATE' AND NEW.order_id <> OLD.order_id AND EXISTS (
      SELECT 1 FROM cutting_orders
      WHERE id = NEW.order_id AND status = 'VERIFIED'
    )
  ) THEN
    RAISE EXCEPTION 'the component counts of a VERIFIED order are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER verification_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON verification_items
  FOR EACH ROW EXECUTE FUNCTION verification_items_guard();
