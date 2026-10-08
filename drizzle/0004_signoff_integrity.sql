-- Sign-off integrity. Closes three ways of getting a batch past the gatekeeper
-- with a query that bypasses the API, which the earlier triggers did not cover:
--   1. approving against a checklist that no longer matches the recipe
--      (a component row removed, or an expected quantity lowered);
--   2. moving an order to VERIFIED or REJECTED with no signed decision;
--   3. writing a forged decision: for an order that is not at the QC station,
--      in the name of a user who is not a verifier, or backdated.

-- 1a. As before, plus: an order can only become VERIFIED when its checklist is
--     the recipe's checklist. Every recipe component must be present with the
--     quantity the batch size requires, and nothing else may be on it.
CREATE OR REPLACE FUNCTION cutting_orders_guard() RETURNS trigger
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

  IF NEW.status = 'VERIFIED' AND OLD.status <> 'VERIFIED' AND (
    EXISTS (
      SELECT 1 FROM recipe_components rc
      LEFT JOIN verification_items vi
        ON vi.order_id = NEW.id AND vi.component_id = rc.id
      WHERE rc.recipe_id = NEW.recipe_id
        AND (vi.id IS NULL OR vi.expected_qty <> NEW.target_qty * rc.pieces_per_garment)
    )
    OR EXISTS (
      SELECT 1 FROM verification_items vi
      JOIN recipe_components rc ON rc.id = vi.component_id
      WHERE vi.order_id = NEW.id AND rc.recipe_id <> NEW.recipe_id
    )
  ) THEN
    RAISE EXCEPTION 'cutting order % cannot be VERIFIED: its checklist does not match the recipe', OLD.order_no
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

-- 1b. As before, plus: the checklist is built while the order is
--     CUTTING_IN_PROGRESS and is fixed from then on. After submission rows
--     cannot be added or removed, and what a row expects can never be edited;
--     only the verifier's count changes.
CREATE OR REPLACE FUNCTION verification_items_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  item_order_id integer;
  -- Stays NULL when the order itself is being deleted (cascade).
  item_order_status order_status;
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

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.order_id, NEW.component_id, NEW.expected_qty)
      IS DISTINCT FROM (OLD.order_id, OLD.component_id, OLD.expected_qty) THEN
      RAISE EXCEPTION 'the checklist of a cutting order is fixed: only the counted quantity of a component can change'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  SELECT status INTO item_order_status FROM cutting_orders WHERE id = item_order_id;
  IF item_order_status <> 'CUTTING_IN_PROGRESS' THEN
    RAISE EXCEPTION 'the checklist of a cutting order is fixed once it is submitted: components cannot be added or removed while it is %', item_order_status
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- 3. A decision is only accepted from a Cutting Verifier, for an order that is
--    at the QC station, and its time is always the database clock.
CREATE FUNCTION verification_logs_decision_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  signer_role user_role;
  decided_order_status order_status;
BEGIN
  SELECT role INTO signer_role FROM users WHERE id = NEW.verifier_id;
  IF signer_role IS DISTINCT FROM 'cutting_verifier' THEN
    RAISE EXCEPTION 'a verification decision can only be signed by a cutting verifier'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT status INTO decided_order_status FROM cutting_orders WHERE id = NEW.order_id;
  IF decided_order_status IS DISTINCT FROM 'PENDING_VERIFICATION' THEN
    RAISE EXCEPTION 'a verification decision can only be recorded for an order that is PENDING_VERIFICATION'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW."timestamp" := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER verification_logs_decision_guard
  BEFORE INSERT ON verification_logs
  FOR EACH ROW EXECUTE FUNCTION verification_logs_decision_guard();
--> statement-breakpoint

--    Checked when the transaction commits: the order must have ended up where
--    the decision says, so an approval or rejection row cannot be left behind
--    on an order that never moved.
CREATE FUNCTION verification_logs_decision_took_effect() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cutting_orders
    WHERE id = NEW.order_id
      AND status = CASE NEW.decision
        WHEN 'APPROVED' THEN 'VERIFIED'::order_status
        ELSE 'REJECTED'::order_status
      END
  ) THEN
    RAISE EXCEPTION 'a % decision was recorded, but its order was not moved to the matching status in the same transaction', NEW.decision
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER verification_logs_decision_took_effect
  AFTER INSERT ON verification_logs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verification_logs_decision_took_effect();
--> statement-breakpoint

-- 2. The other half, also checked at commit: an order cannot become VERIFIED
--    or REJECTED unless the matching decision was signed in the same
--    transaction. The guard above stamps every decision with now(), which is
--    the transaction's start time, so that is what identifies "this
--    transaction": an older rejection of the same order does not count.
CREATE FUNCTION cutting_orders_decision_is_signed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM verification_logs
    WHERE order_id = NEW.id
      AND "timestamp" = now()
      AND decision = CASE NEW.status
        WHEN 'VERIFIED' THEN 'APPROVED'::verification_decision
        ELSE 'REJECTED'::verification_decision
      END
  ) THEN
    RAISE EXCEPTION 'cutting order % cannot become % without a signed verification decision in the same transaction', NEW.order_no, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER cutting_orders_decision_is_signed
  AFTER UPDATE ON cutting_orders
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('VERIFIED', 'REJECTED'))
  EXECUTE FUNCTION cutting_orders_decision_is_signed();
