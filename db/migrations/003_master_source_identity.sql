-- R2-01: stable master source identities are fixed at INSERT, even before
-- content exists. NULL is an identity value, not permission to fill it later.
-- New identities require new masters; names/catalog metadata remain descriptive.
-- No repair, inference or rewriting of historical rows is performed.
LOCK TABLE rdtr.geo_region, rdtr.rdtr_plan, rdtr.plan_version
 IN SHARE ROW EXCLUSIVE MODE;

-- Only the known offline-ingester envelope asserts a provider/namespace.
-- Unmarked metadata or absent context is not evidence of historical identity.
-- When that context is present it must be well-typed and agree literally;
-- JSON numbers are not source strings and leading zeros are never normalized.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM rdtr.plan_version v
  JOIN rdtr.rdtr_plan p ON p.id=v.plan_id
  JOIN rdtr.geo_region g ON g.id=p.region_id
  WHERE v.layer_metadata->>'artifactKind'='validated_source_cache'
   AND v.layer_metadata ? 'context'
   AND (
    jsonb_typeof(v.layer_metadata->'context') IS DISTINCT FROM 'object'
    OR jsonb_typeof(v.layer_metadata#>'{context,id}') IS DISTINCT FROM 'string'
    OR jsonb_typeof(v.layer_metadata#>'{context,region_id}') IS DISTINCT FROM 'string'
    OR (v.layer_metadata#>>'{context,id}') IS DISTINCT FROM p.source_plan_id
    OR (v.layer_metadata#>>'{context,region_id}') IS DISTINCT FROM g.source_region_id
    OR p.source_provider IS DISTINCT FROM 'gistaru'
    OR v.source_provider IS DISTINCT FROM 'gistaru'
    OR g.id_namespace IS DISTINCT FROM 'gistaru'
   )
 ) THEN
  RAISE EXCEPTION 'Existing RDTR master source context is inconsistent'
   USING ERRCODE='23503', SCHEMA='rdtr', CONSTRAINT='master_source_context_consistency';
 END IF;
END $$;

CREATE FUNCTION rdtr.guard_master_source_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF TG_TABLE_NAME='rdtr_plan' THEN
  IF (NEW.source_provider,NEW.source_plan_id,NEW.region_id) IS DISTINCT FROM
     (OLD.source_provider,OLD.source_plan_id,OLD.region_id) THEN
   RAISE EXCEPTION 'Plan master source identity is immutable'
    USING ERRCODE='23503', SCHEMA='rdtr', TABLE='rdtr_plan',
     CONSTRAINT='rdtr_plan_source_identity';
  END IF;
 ELSE
  IF (NEW.id_namespace,NEW.source_region_id) IS DISTINCT FROM
     (OLD.id_namespace,OLD.source_region_id) THEN
   RAISE EXCEPTION 'Region master source identity is immutable'
    USING ERRCODE='23503', SCHEMA='rdtr', TABLE='geo_region',
     CONSTRAINT='geo_region_source_identity';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_master_source_identity
 BEFORE UPDATE OF source_provider,source_plan_id,region_id ON rdtr.rdtr_plan
 FOR EACH ROW EXECUTE FUNCTION rdtr.guard_master_source_identity();
CREATE TRIGGER guard_master_source_identity
 BEFORE UPDATE OF id_namespace,source_region_id ON rdtr.geo_region
 FOR EACH ROW EXECUTE FUNCTION rdtr.guard_master_source_identity();
REVOKE ALL ON FUNCTION rdtr.guard_master_source_identity() FROM PUBLIC, siap_izin_readonly;
