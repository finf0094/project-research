-- Also announce progress (a sync that brought new events changes last_seq): the monitoring list shows
-- the number of answers. Going silent changes no row; the page's periodic reload shows that.
CREATE OR REPLACE FUNCTION attempts_notify() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.connection IS DISTINCT FROM OLD.connection
     OR NEW.risk_score IS DISTINCT FROM OLD.risk_score
     OR NEW.deadline IS DISTINCT FROM OLD.deadline
     OR NEW.last_seq IS DISTINCT FROM OLD.last_seq THEN
    PERFORM pg_notify('attempt_updates', NEW.exam_id || ':' || NEW.id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
