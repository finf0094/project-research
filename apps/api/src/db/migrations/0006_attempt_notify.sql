-- Live monitoring (architecture, section 19.2): changes to what the examiner's page shows are announced to
-- listening API processes, whichever process made it (API or worker). The payload is "<exam_id>:<attempt_id>".
CREATE FUNCTION attempts_notify() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.connection IS DISTINCT FROM OLD.connection
     OR NEW.risk_score IS DISTINCT FROM OLD.risk_score
     OR NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    PERFORM pg_notify('attempt_updates', NEW.exam_id || ':' || NEW.id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER attempts_notify AFTER INSERT OR UPDATE ON attempts
  FOR EACH ROW EXECUTE FUNCTION attempts_notify();
