-- Additive hardening of 001: provenance parent identities cannot be reparented.
-- Serialize preflight with ordinary writers, including direct SQL not using migrate().
-- Locks last until the caller's enclosing transaction ends; no data is repaired.
LOCK TABLE rdtr.import_run, rdtr.source_artifact, rdtr.plan_version,
 rdtr.plan_observation, rdtr.zone_feature, rdtr.local_activity,
 rdtr.rule_evidence, rdtr.quarantined_feature IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM rdtr.plan_version v
  LEFT JOIN rdtr.import_run r ON r.id=v.created_from_run_id
  WHERE r.id IS NULL OR r.plan_id IS DISTINCT FROM v.plan_id
 ) OR EXISTS (
  SELECT 1 FROM rdtr.plan_observation o
  LEFT JOIN rdtr.plan_version v ON v.id=o.plan_version_id
  LEFT JOIN rdtr.import_run r ON r.id=o.import_run_id
  WHERE v.id IS NULL OR r.id IS NULL OR v.plan_id IS DISTINCT FROM r.plan_id
 ) OR EXISTS (
  SELECT 1 FROM (
   SELECT plan_version_id,source_artifact_id FROM rdtr.zone_feature
   UNION ALL
   SELECT plan_version_id,source_artifact_id FROM rdtr.local_activity
   UNION ALL
   SELECT plan_version_id,source_artifact_id FROM rdtr.rule_evidence
  ) c
  LEFT JOIN rdtr.plan_version v ON v.id=c.plan_version_id
  LEFT JOIN rdtr.source_artifact a ON a.id=c.source_artifact_id
  LEFT JOIN rdtr.import_run r ON r.id=a.import_run_id
  WHERE c.source_artifact_id IS NOT NULL AND
   (v.id IS NULL OR a.id IS NULL OR r.id IS NULL OR v.plan_id IS DISTINCT FROM r.plan_id)
 ) OR EXISTS (
  SELECT 1 FROM rdtr.quarantined_feature q
  LEFT JOIN rdtr.source_artifact a ON a.id=q.source_artifact_id
  LEFT JOIN rdtr.import_run r ON r.id=q.import_run_id
  WHERE a.id IS NULL OR r.id IS NULL OR a.import_run_id IS DISTINCT FROM q.import_run_id
 ) THEN
  RAISE EXCEPTION 'Existing RDTR provenance is inconsistent'
   USING ERRCODE='23503', SCHEMA='rdtr', CONSTRAINT='provenance_plan_consistency';
 END IF;
END $$;

-- Keep the scope narrow: status/count/validation updates remain legal. A new
-- retrieval creates a new run; content_same observations may use any later run
-- of the same plan without changing the version's original retrieval identity.
CREATE FUNCTION rdtr.guard_provenance_parent_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF TG_TABLE_NAME='import_run' THEN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
   RAISE EXCEPTION 'Import run provenance identity is immutable'
    USING ERRCODE='23503', SCHEMA='rdtr', TABLE='import_run',
     CONSTRAINT='import_run_provenance_identity';
  END IF;
 ELSE
  IF (NEW.plan_id,NEW.created_from_run_id) IS DISTINCT FROM
     (OLD.plan_id,OLD.created_from_run_id) THEN
   RAISE EXCEPTION 'Plan version provenance identity is immutable'
    USING ERRCODE='23503', SCHEMA='rdtr', TABLE='plan_version',
     CONSTRAINT='plan_version_provenance_identity';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_provenance_parent_identity
 BEFORE UPDATE OF plan_id ON rdtr.import_run
 FOR EACH ROW EXECUTE FUNCTION rdtr.guard_provenance_parent_identity();
CREATE TRIGGER guard_provenance_parent_identity
 BEFORE UPDATE OF plan_id,created_from_run_id ON rdtr.plan_version
 FOR EACH ROW EXECUTE FUNCTION rdtr.guard_provenance_parent_identity();
REVOKE ALL ON FUNCTION rdtr.guard_provenance_parent_identity() FROM PUBLIC, siap_izin_readonly;
