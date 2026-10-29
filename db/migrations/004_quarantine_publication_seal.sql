-- Additive publication seal for the original retrieval's quarantine evidence.
-- No repair or deletion: inconsistent already-published counts abort migration.
LOCK TABLE rdtr.plan_version, rdtr.quarantined_feature IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM rdtr.plan_version v
  WHERE v.published_at IS NOT NULL AND
   v.quarantined_feature_count IS DISTINCT FROM
    (SELECT count(*) FROM rdtr.quarantined_feature q WHERE q.import_run_id=v.created_from_run_id)
 ) THEN
  RAISE EXCEPTION 'Published quarantine counts are inconsistent'
   USING ERRCODE='23514', SCHEMA='rdtr', CONSTRAINT='published_quarantine_count';
 END IF;
END $$;

CREATE FUNCTION rdtr.guard_quarantine_publication() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
DECLARE old_run uuid; new_run uuid; version_row record;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_run:=OLD.import_run_id; END IF;
 IF TG_OP <> 'DELETE' THEN new_run:=NEW.import_run_id; END IF;
 -- Match the producer's version lock before checking its seal, including q0
 -- late insertions and both sides of reparenting. Later observation runs are
 -- intentionally not sealed by a version created from an earlier retrieval.
 FOR version_row IN
  SELECT id,published_at FROM rdtr.plan_version
  WHERE created_from_run_id IN (old_run,new_run) ORDER BY id FOR UPDATE
 LOOP
  IF version_row.published_at IS NOT NULL THEN
   RAISE EXCEPTION 'Published origin quarantine is immutable'
    USING ERRCODE='55000', SCHEMA='rdtr', TABLE='quarantined_feature',
     CONSTRAINT='quarantine_publication_seal';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_quarantine_publication
 BEFORE INSERT OR UPDATE OR DELETE ON rdtr.quarantined_feature
 FOR EACH ROW EXECUTE FUNCTION rdtr.guard_quarantine_publication();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON rdtr.quarantined_feature
 FOR EACH STATEMENT EXECUTE FUNCTION rdtr.reject_mutation();
REVOKE ALL ON FUNCTION rdtr.guard_quarantine_publication() FROM PUBLIC, siap_izin_readonly;
