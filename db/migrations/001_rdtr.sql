-- Local private RDTR foundation. Application pipeline is not changed by this DDL.
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

CREATE TABLE rdtr.geo_region (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 id_namespace text NOT NULL, source_region_id text,
 UNIQUE(id_namespace,source_region_id)
);
CREATE TABLE rdtr.rdtr_plan (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid NOT NULL,
 source_provider text NOT NULL, source_plan_id text, name text NOT NULL,
 catalog_state text NOT NULL DEFAULT 'unknown', source_metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rdtr.import_run (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL,
 batch_key text NOT NULL, status text NOT NULL DEFAULT 'pending',
 started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 query_template text, query_parameters jsonb NOT NULL DEFAULT '{}',
 retrieval_scope text NOT NULL DEFAULT 'unknown', source_filter jsonb NOT NULL DEFAULT '{}',
 expected_id_count bigint, received_id_count bigint, valid_count bigint, quarantined_count bigint,
 failure_reason text, manifest_hash text, validation_result jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rdtr.source_artifact (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_run_id uuid NOT NULL,
 kind text NOT NULL, public_url text, request_parameters jsonb NOT NULL DEFAULT '{}',
 retrieved_at timestamptz NOT NULL DEFAULT now(), http_status integer,
 sha256 text NOT NULL, byte_size bigint NOT NULL, mime_type text,
 blob_locator text NOT NULL, source_time timestamptz
);
CREATE TABLE rdtr.plan_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL,
 created_from_run_id uuid NOT NULL, content_fingerprint text NOT NULL,
 layer_path text NOT NULL, source_provider text, native_srid integer, output_srid integer NOT NULL DEFAULT 4326,
 field_definitions jsonb NOT NULL DEFAULT '[]', layer_metadata jsonb NOT NULL DEFAULT '{}',
 geometry_scope text NOT NULL DEFAULT 'unknown', rules_scope text NOT NULL DEFAULT 'unknown',
 ingest_state text NOT NULL DEFAULT 'pending', freshness_state text NOT NULL DEFAULT 'unchecked_since_import',
 source_filter jsonb NOT NULL DEFAULT '{}', coverage jsonb NOT NULL DEFAULT '{}',
 source_id_count bigint, valid_feature_count bigint, quarantined_feature_count bigint,
 ids_reconciled boolean NOT NULL DEFAULT false,
 source_time timestamptz, regulation_effective_date date,
 created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE rdtr.plan_observation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id uuid NOT NULL,
 import_run_id uuid NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(),
 result text NOT NULL, validation_result jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rdtr.zone_feature (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id uuid NOT NULL,
 source_object_id bigint NOT NULL, zone_code text, zone_name text, subzone_code text, subzone_name text,
 source_properties jsonb NOT NULL DEFAULT '{}', source_artifact_id uuid, feature_locator text,
 geom_original_4326 public.geometry(Geometry,4326) NOT NULL,
 bounds public.geometry(Polygon,4326) GENERATED ALWAYS AS (public.ST_Envelope(geom_original_4326)) STORED,
 geometry_hash text, properties_hash text
);
CREATE TABLE rdtr.quarantined_feature (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_run_id uuid NOT NULL,
 source_artifact_id uuid NOT NULL, source_object_id bigint, feature_locator text NOT NULL,
 error_code text NOT NULL, reason text NOT NULL, details jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rdtr.zone_match_key (
 plan_version_id uuid NOT NULL, zone_feature_id uuid NOT NULL, field_name text NOT NULL,
 raw_value text NOT NULL, PRIMARY KEY(plan_version_id,zone_feature_id,field_name,raw_value)
);
CREATE TABLE rdtr.zone_display (
 plan_version_id uuid NOT NULL, zone_feature_id uuid NOT NULL, level integer NOT NULL,
 algorithm_version text NOT NULL, source_geometry_hash text NOT NULL, method text NOT NULL,
 parameters jsonb NOT NULL DEFAULT '{}', fallback_reason text,
 qc_state text NOT NULL DEFAULT 'unknown', qc_result jsonb NOT NULL DEFAULT '{}',
 geom_display_4326 public.geometry(Geometry,4326) NOT NULL,
 PRIMARY KEY(plan_version_id,zone_feature_id,level,algorithm_version)
);
CREATE TABLE rdtr.local_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id uuid NOT NULL,
 source_activity_id text NOT NULL, name text NOT NULL,
 source_payload jsonb NOT NULL DEFAULT '{}', source_artifact_id uuid, source_locator text
);
CREATE TABLE rdtr.activity_zone_rule (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id uuid NOT NULL,
 local_activity_id uuid NOT NULL, evidence_kind text NOT NULL DEFAULT 'unknown',
 raw_category jsonb, permission_status text NOT NULL DEFAULT 'unknown',
 conditions_text text, conditions_payload jsonb NOT NULL DEFAULT '{}',
 source_locator text, review_state text NOT NULL DEFAULT 'unreviewed',
 source_payload jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rdtr.rule_target (
 plan_version_id uuid NOT NULL, rule_id uuid NOT NULL, field_name text NOT NULL,
 raw_value text NOT NULL, additional_scope jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(plan_version_id,rule_id,field_name,raw_value)
);
CREATE TABLE rdtr.rule_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id uuid NOT NULL,
 rule_id uuid NOT NULL, source_artifact_id uuid NOT NULL, kind text NOT NULL DEFAULT 'unknown',
 locator text NOT NULL, scope_kind text NOT NULL DEFAULT 'unknown',
 scope_payload jsonb NOT NULL DEFAULT '{}', source_payload jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE rdtr.kbli_entry (
 kbli_version text NOT NULL, kbli_code text NOT NULL, description text NOT NULL,
 source_reference text, scope jsonb NOT NULL DEFAULT '{}', PRIMARY KEY(kbli_version,kbli_code)
);
CREATE TABLE rdtr.kbli_activity_mapping (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_version_id uuid NOT NULL,
 local_activity_id uuid NOT NULL, kbli_version text NOT NULL, kbli_code text NOT NULL,
 scope_key text NOT NULL DEFAULT 'unknown', scope jsonb NOT NULL DEFAULT '{}',
 assumptions jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1,
 basis text NOT NULL, reviewer text, reviewed_at timestamptz,
 review_state text NOT NULL DEFAULT 'unreviewed', published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rdtr.dataset_release (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), schema_version text NOT NULL DEFAULT '001_rdtr',
 manifest_hash text NOT NULL, status text NOT NULL DEFAULT 'draft',
 source_kind text NOT NULL DEFAULT 'local_dataset', created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz, published_by text, coverage_notes text,
 manifest jsonb NOT NULL DEFAULT '{}', partial_release boolean NOT NULL DEFAULT false
);
CREATE TABLE rdtr.release_plan_version (
 release_id uuid NOT NULL, plan_id uuid NOT NULL, plan_version_id uuid NOT NULL,
 geometry_scope text NOT NULL DEFAULT 'unknown', rules_scope text NOT NULL DEFAULT 'unknown',
 ingest_state text NOT NULL DEFAULT 'pending', mapping_review_state text NOT NULL DEFAULT 'not_available',
 freshness_state text NOT NULL DEFAULT 'unchecked_since_import',
 known_available_feature_count bigint, coverage jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(release_id,plan_id)
);
CREATE TABLE rdtr.release_mapping (
 release_id uuid NOT NULL, mapping_id uuid NOT NULL, plan_id uuid NOT NULL,
 plan_version_id uuid NOT NULL, PRIMARY KEY(release_id,mapping_id)
);
CREATE TABLE rdtr.active_release (
 channel text PRIMARY KEY, release_id uuid NOT NULL,
 activated_at timestamptz NOT NULL DEFAULT now(), activated_by text NOT NULL
);

-- Literal identifiers are text; no trimming, case folding or numeric conversion.
ALTER TABLE rdtr.geo_region ADD CHECK (id_namespace <> '' AND (source_region_id IS NULL OR source_region_id <> ''));
ALTER TABLE rdtr.rdtr_plan ADD CHECK (source_provider <> '' AND (source_plan_id IS NULL OR source_plan_id <> '')),
 ADD CHECK (catalog_state IN ('listed','not_listed','unknown')),
 ADD UNIQUE(source_provider,source_plan_id);
ALTER TABLE rdtr.import_run
 ADD CHECK (status IN ('pending','running','ready','partial','failed')),
 ADD CHECK (retrieval_scope IN ('complete_layer','filtered_subset','none','unknown')),
 ADD CHECK (expected_id_count >= 0 AND received_id_count >= 0 AND valid_count >= 0 AND quarantined_count >= 0),
 ADD CHECK (manifest_hash IS NULL OR manifest_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE rdtr.source_artifact ADD CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 ADD CHECK (byte_size >= 0), ADD CHECK (http_status BETWEEN 100 AND 599), ADD CHECK (blob_locator <> '');
ALTER TABLE rdtr.plan_version
 ADD CHECK (content_fingerprint ~ '^[0-9a-f]{64}$'), ADD CHECK (layer_path <> ''), ADD CHECK(output_srid=4326),
 ADD CHECK (geometry_scope IN ('complete_layer','filtered_subset','none','unknown')),
 ADD CHECK (rules_scope IN ('source_matrix','filter_membership_only','partial','missing','unknown')),
 ADD CHECK (ingest_state IN ('ready','partial','failed','pending')),
 ADD CHECK (freshness_state IN ('dated_snapshot','unchecked_since_import','update_known','withdrawn')),
 ADD CHECK (source_id_count >= 0 AND valid_feature_count >= 0 AND quarantined_feature_count >= 0),
 ADD CHECK (geometry_scope <> 'complete_layer' OR
   (ids_reconciled AND source_id_count IS NOT NULL AND valid_feature_count IS NOT NULL
    AND quarantined_feature_count IS NOT NULL AND source_id_count=valid_feature_count+quarantined_feature_count)),
 ADD UNIQUE(plan_id,content_fingerprint);
ALTER TABLE rdtr.plan_observation ADD CHECK(result IN ('content_same','content_changed'));
ALTER TABLE rdtr.zone_feature ADD CHECK(source_object_id>=0),
 ADD UNIQUE(plan_version_id,source_object_id),
 ADD CHECK (public.GeometryType(geom_original_4326) IN ('POLYGON','MULTIPOLYGON')
   AND NOT public.ST_IsEmpty(geom_original_4326) AND public.ST_IsValid(geom_original_4326)
   AND public.ST_NDims(geom_original_4326)=2
   AND public.ST_XMin(geom_original_4326)>=-180 AND public.ST_XMax(geom_original_4326)<=180
   AND public.ST_YMin(geom_original_4326)>=-90 AND public.ST_YMax(geom_original_4326)<=90),
 ADD CHECK(geometry_hash IS NULL OR geometry_hash ~ '^[0-9a-f]{64}$'),
 ADD CHECK(properties_hash IS NULL OR properties_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE rdtr.zone_display ADD CHECK(level>=0), ADD CHECK(source_geometry_hash ~ '^[0-9a-f]{64}$'),
 ADD CHECK (qc_state IN ('unknown','passed','fallback')),
 ADD CHECK (public.GeometryType(geom_display_4326) IN ('POLYGON','MULTIPOLYGON')
   AND NOT public.ST_IsEmpty(geom_display_4326) AND public.ST_IsValid(geom_display_4326)
   AND public.ST_NDims(geom_display_4326)=2
   AND public.ST_XMin(geom_display_4326)>=-180 AND public.ST_XMax(geom_display_4326)<=180
   AND public.ST_YMin(geom_display_4326)>=-90 AND public.ST_YMax(geom_display_4326)<=90);
ALTER TABLE rdtr.local_activity ADD CHECK(source_activity_id<>''), ADD UNIQUE(plan_version_id,source_activity_id);
ALTER TABLE rdtr.activity_zone_rule
 ADD CHECK(permission_status IN ('unknown','allowed','limited','conditional','limited_conditional','prohibited')),
 ADD CHECK(review_state IN ('unreviewed','reviewed','conflict')),
 ADD CHECK(evidence_kind <> 'filter_membership' OR permission_status='unknown');
ALTER TABLE rdtr.rule_evidence ADD CHECK(scope_kind IN ('unknown','point','block','zone','plan','document'));
ALTER TABLE rdtr.kbli_entry ADD CHECK(kbli_version<>''), ADD CHECK(kbli_code ~ '^[0-9]{5}$');
ALTER TABLE rdtr.kbli_activity_mapping ADD CHECK(revision>0),
 ADD CHECK(review_state IN ('unreviewed','reviewed','conflict','not_available')),
 ADD UNIQUE(plan_version_id,local_activity_id,kbli_version,kbli_code,scope_key,revision);
ALTER TABLE rdtr.dataset_release ADD CHECK(manifest_hash ~ '^[0-9a-f]{64}$'),
 ADD CHECK(status IN ('draft','published')), ADD CHECK(source_kind='local_dataset'),
 ADD CHECK((status='published')=(published_at IS NOT NULL));
ALTER TABLE rdtr.release_plan_version
 ADD CHECK(geometry_scope IN ('complete_layer','filtered_subset','none','unknown')),
 ADD CHECK(rules_scope IN ('source_matrix','filter_membership_only','partial','missing','unknown')),
 ADD CHECK(ingest_state IN ('ready','partial','failed','pending')),
 ADD CHECK(mapping_review_state IN ('unreviewed','reviewed','conflict','not_available')),
 ADD CHECK(freshness_state IN ('dated_snapshot','unchecked_since_import','update_known','withdrawn')),
 ADD CHECK(known_available_feature_count>=0);

-- Composite parent keys bind every local identity to its content version.
ALTER TABLE rdtr.rdtr_plan ADD FOREIGN KEY(region_id) REFERENCES rdtr.geo_region(id);
ALTER TABLE rdtr.import_run ADD UNIQUE(plan_id,id), ADD FOREIGN KEY(plan_id) REFERENCES rdtr.rdtr_plan(id);
ALTER TABLE rdtr.source_artifact ADD UNIQUE(import_run_id,id),
 ADD FOREIGN KEY(import_run_id) REFERENCES rdtr.import_run(id);
ALTER TABLE rdtr.plan_version ADD UNIQUE(plan_id,id),
 ADD FOREIGN KEY(plan_id) REFERENCES rdtr.rdtr_plan(id),
 ADD FOREIGN KEY(plan_id,created_from_run_id) REFERENCES rdtr.import_run(plan_id,id);
ALTER TABLE rdtr.plan_observation ADD FOREIGN KEY(plan_version_id) REFERENCES rdtr.plan_version(id),
 ADD FOREIGN KEY(import_run_id) REFERENCES rdtr.import_run(id);
ALTER TABLE rdtr.zone_feature ADD UNIQUE(plan_version_id,id),
 ADD FOREIGN KEY(plan_version_id) REFERENCES rdtr.plan_version(id),
 ADD FOREIGN KEY(source_artifact_id) REFERENCES rdtr.source_artifact(id);
ALTER TABLE rdtr.quarantined_feature ADD FOREIGN KEY(import_run_id) REFERENCES rdtr.import_run(id),
 ADD FOREIGN KEY(import_run_id,source_artifact_id) REFERENCES rdtr.source_artifact(import_run_id,id);
ALTER TABLE rdtr.zone_match_key ADD FOREIGN KEY(plan_version_id,zone_feature_id) REFERENCES rdtr.zone_feature(plan_version_id,id);
ALTER TABLE rdtr.zone_display ADD FOREIGN KEY(plan_version_id,zone_feature_id) REFERENCES rdtr.zone_feature(plan_version_id,id);
ALTER TABLE rdtr.local_activity ADD UNIQUE(plan_version_id,id),
 ADD FOREIGN KEY(plan_version_id) REFERENCES rdtr.plan_version(id),
 ADD FOREIGN KEY(source_artifact_id) REFERENCES rdtr.source_artifact(id);
ALTER TABLE rdtr.activity_zone_rule ADD UNIQUE(plan_version_id,id),
 ADD FOREIGN KEY(plan_version_id,local_activity_id) REFERENCES rdtr.local_activity(plan_version_id,id);
ALTER TABLE rdtr.rule_target ADD FOREIGN KEY(plan_version_id,rule_id) REFERENCES rdtr.activity_zone_rule(plan_version_id,id);
ALTER TABLE rdtr.rule_evidence ADD FOREIGN KEY(plan_version_id,rule_id) REFERENCES rdtr.activity_zone_rule(plan_version_id,id),
 ADD FOREIGN KEY(source_artifact_id) REFERENCES rdtr.source_artifact(id);
ALTER TABLE rdtr.kbli_activity_mapping ADD UNIQUE(plan_version_id,id),
 ADD FOREIGN KEY(plan_version_id,local_activity_id) REFERENCES rdtr.local_activity(plan_version_id,id),
 ADD FOREIGN KEY(kbli_version,kbli_code) REFERENCES rdtr.kbli_entry(kbli_version,kbli_code);
ALTER TABLE rdtr.release_plan_version ADD UNIQUE(release_id,plan_id,plan_version_id),
 ADD FOREIGN KEY(release_id) REFERENCES rdtr.dataset_release(id),
 ADD FOREIGN KEY(plan_id,plan_version_id) REFERENCES rdtr.plan_version(plan_id,id);
ALTER TABLE rdtr.release_mapping
 ADD FOREIGN KEY(release_id,plan_id,plan_version_id) REFERENCES rdtr.release_plan_version(release_id,plan_id,plan_version_id),
 ADD FOREIGN KEY(plan_version_id,mapping_id) REFERENCES rdtr.kbli_activity_mapping(plan_version_id,id);
ALTER TABLE rdtr.active_release ADD FOREIGN KEY(release_id) REFERENCES rdtr.dataset_release(id);

CREATE INDEX zone_feature_geometry_gist ON rdtr.zone_feature USING gist(geom_original_4326);
CREATE INDEX zone_display_geometry_gist ON rdtr.zone_display USING gist(geom_display_4326);
CREATE INDEX zone_match_lookup ON rdtr.zone_match_key(plan_version_id,field_name,raw_value);
CREATE INDEX rule_target_lookup ON rdtr.rule_target(plan_version_id,field_name,raw_value);
CREATE INDEX mapping_kbli_lookup ON rdtr.kbli_activity_mapping(kbli_version,kbli_code,plan_version_id);
CREATE INDEX release_version_lookup ON rdtr.release_plan_version(plan_version_id);
CREATE INDEX observation_version_lookup ON rdtr.plan_observation(plan_version_id);
CREATE INDEX evidence_rule_lookup ON rdtr.rule_evidence(plan_version_id,rule_id);

-- Publication is a one-way seal, not an activation flag. Parent row locks serialize
-- child writers with sealing; a published package can only be replaced by new IDs.
CREATE FUNCTION rdtr.guard_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.published_at IS NOT NULL THEN
  RAISE EXCEPTION 'Published plan content is immutable' USING ERRCODE='55000';
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.published_at IS NOT NULL THEN
  IF NEW.ingest_state <> 'ready' OR
     (NEW.valid_feature_count IS NOT NULL AND NEW.valid_feature_count <> (SELECT count(*) FROM rdtr.zone_feature WHERE plan_version_id=NEW.id)) OR
     EXISTS(SELECT 1 FROM rdtr.zone_feature f WHERE f.plan_version_id=NEW.id AND NOT EXISTS
      (SELECT 1 FROM rdtr.zone_display d WHERE d.plan_version_id=f.plan_version_id AND d.zone_feature_id=f.id AND d.qc_state IN ('passed','fallback'))) THEN
   RAISE EXCEPTION 'Plan version is not prepared for publication' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_version BEFORE INSERT OR UPDATE OR DELETE ON rdtr.plan_version FOR EACH ROW EXECUTE FUNCTION rdtr.guard_version();

CREATE FUNCTION rdtr.guard_version_child() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
DECLARE old_id uuid; new_id uuid; parent record;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_id := OLD.plan_version_id; END IF;
 IF TG_OP <> 'DELETE' THEN new_id := NEW.plan_version_id; END IF;
 FOR parent IN SELECT published_at FROM rdtr.plan_version WHERE id IN (old_id,new_id) ORDER BY id FOR UPDATE LOOP
  IF parent.published_at IS NOT NULL THEN
   RAISE EXCEPTION 'Published plan content is immutable' USING ERRCODE='55000';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['zone_feature','zone_match_key','zone_display','local_activity','activity_zone_rule','rule_target','rule_evidence'] LOOP
  EXECUTE format('CREATE TRIGGER guard_version_child BEFORE INSERT OR UPDATE OR DELETE ON rdtr.%I FOR EACH ROW EXECUTE FUNCTION rdtr.guard_version_child()',t);
 END LOOP;
END $$;

CREATE FUNCTION rdtr.guard_mapping() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.published_at IS NOT NULL THEN
  RAISE EXCEPTION 'Published mapping revision is immutable' USING ERRCODE='55000';
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.published_at IS NOT NULL THEN
  PERFORM 1 FROM rdtr.kbli_entry WHERE kbli_version=NEW.kbli_version AND kbli_code=NEW.kbli_code FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM rdtr.plan_version WHERE id=NEW.plan_version_id AND published_at IS NOT NULL FOR SHARE) THEN
   RAISE EXCEPTION 'Mapping requires a published plan version' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_mapping BEFORE INSERT OR UPDATE OR DELETE ON rdtr.kbli_activity_mapping FOR EACH ROW EXECUTE FUNCTION rdtr.guard_mapping();

CREATE FUNCTION rdtr.guard_kbli() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM rdtr.kbli_activity_mapping WHERE kbli_version=OLD.kbli_version AND kbli_code=OLD.kbli_code AND published_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Published KBLI content is immutable' USING ERRCODE='55000';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_kbli BEFORE UPDATE OR DELETE ON rdtr.kbli_entry FOR EACH ROW EXECUTE FUNCTION rdtr.guard_kbli();

CREATE FUNCTION rdtr.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Archived or published content cannot be mutated' USING ERRCODE='55000'; END $$;
CREATE TRIGGER artifact_immutable BEFORE UPDATE OR DELETE ON rdtr.source_artifact FOR EACH ROW EXECUTE FUNCTION rdtr.reject_mutation();

-- Cluster role is created only when absent; never alter an existing role's identity.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='siap_izin_readonly') THEN
  BEGIN
   CREATE ROLE siap_izin_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='siap_izin_readonly'
  AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Existing RDTR reader role is unsafe' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON SCHEMA rdtr FROM PUBLIC, siap_izin_readonly;
GRANT USAGE ON SCHEMA rdtr TO siap_izin_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA rdtr FROM PUBLIC, siap_izin_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA rdtr TO siap_izin_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA rdtr REVOKE ALL ON TABLES FROM PUBLIC, siap_izin_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA rdtr GRANT SELECT ON TABLES TO siap_izin_readonly;

CREATE FUNCTION rdtr.guard_release() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.status='published' THEN
  RAISE EXCEPTION 'Published release definition is immutable' USING ERRCODE='55000';
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.status='published' THEN
  IF EXISTS(SELECT 1 FROM rdtr.release_mapping r JOIN rdtr.kbli_activity_mapping m ON m.id=r.mapping_id
   WHERE r.release_id=NEW.id GROUP BY m.plan_version_id,m.local_activity_id,m.kbli_version,m.kbli_code,m.scope_key HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Release contains conflicting mapping revisions' USING ERRCODE='23505';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rdtr.release_plan_version WHERE release_id=NEW.id) OR
   EXISTS(SELECT 1 FROM rdtr.release_plan_version r JOIN rdtr.plan_version p ON p.id=r.plan_version_id
    WHERE r.release_id=NEW.id AND (p.published_at IS NULL OR r.ingest_state<>p.ingest_state OR r.geometry_scope<>p.geometry_scope OR r.rules_scope<>p.rules_scope)) OR
   EXISTS(SELECT 1 FROM rdtr.release_mapping r JOIN rdtr.kbli_activity_mapping m ON m.id=r.mapping_id
    WHERE r.release_id=NEW.id AND m.published_at IS NULL) THEN
   RAISE EXCEPTION 'Release members are not prepared for publication' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_release BEFORE INSERT OR UPDATE OR DELETE ON rdtr.dataset_release FOR EACH ROW EXECUTE FUNCTION rdtr.guard_release();

CREATE FUNCTION rdtr.guard_release_child() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
DECLARE old_id uuid; new_id uuid; parent record;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_id:=OLD.release_id; END IF;
 IF TG_OP <> 'DELETE' THEN new_id:=NEW.release_id; END IF;
 FOR parent IN SELECT status FROM rdtr.dataset_release WHERE id IN (old_id,new_id) ORDER BY id FOR UPDATE LOOP
  IF parent.status='published' THEN
   RAISE EXCEPTION 'Published release definition is immutable' USING ERRCODE='55000';
  END IF;
 END LOOP;
 IF TG_TABLE_NAME='release_mapping' AND TG_OP<>'DELETE' THEN
  IF EXISTS(SELECT 1 FROM rdtr.release_mapping r
    JOIN rdtr.kbli_activity_mapping a ON a.id=r.mapping_id
    JOIN rdtr.kbli_activity_mapping b ON b.id=NEW.mapping_id
    WHERE r.release_id=NEW.release_id AND r.mapping_id<>NEW.mapping_id
     AND (a.plan_version_id,a.local_activity_id,a.kbli_version,a.kbli_code,a.scope_key)=
         (b.plan_version_id,b.local_activity_id,b.kbli_version,b.kbli_code,b.scope_key)) THEN
   RAISE EXCEPTION 'Release contains conflicting mapping revisions' USING ERRCODE='23505';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_release_child BEFORE INSERT OR UPDATE OR DELETE ON rdtr.release_plan_version FOR EACH ROW EXECUTE FUNCTION rdtr.guard_release_child();
CREATE TRIGGER guard_release_child BEFORE INSERT OR UPDATE OR DELETE ON rdtr.release_mapping FOR EACH ROW EXECUTE FUNCTION rdtr.guard_release_child();

CREATE FUNCTION rdtr.guard_activation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM rdtr.dataset_release WHERE id=NEW.release_id AND status='published' FOR SHARE) THEN
  RAISE EXCEPTION 'Only a published release can be activated' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_activation BEFORE INSERT OR UPDATE ON rdtr.active_release FOR EACH ROW EXECUTE FUNCTION rdtr.guard_activation();

CREATE FUNCTION rdtr.guard_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,rdtr,public AS $$
DECLARE run_id uuid; artifact_plan uuid; version_plan uuid;
BEGIN
 SELECT plan_id INTO version_plan FROM rdtr.plan_version WHERE id=NEW.plan_version_id FOR UPDATE;
 IF TG_TABLE_NAME='plan_observation' THEN
  run_id := NEW.import_run_id;
 ELSE
  IF NEW.source_artifact_id IS NULL THEN RETURN NEW; END IF;
  SELECT import_run_id INTO run_id FROM rdtr.source_artifact WHERE id=NEW.source_artifact_id;
 END IF;
 SELECT plan_id INTO artifact_plan FROM rdtr.import_run WHERE id=run_id FOR SHARE;
 IF artifact_plan IS DISTINCT FROM version_plan THEN
  RAISE EXCEPTION 'Provenance belongs to another plan' USING ERRCODE='23503';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['zone_feature','local_activity','rule_evidence','plan_observation'] LOOP
  EXECUTE format('CREATE TRIGGER guard_provenance BEFORE INSERT OR UPDATE ON rdtr.%I FOR EACH ROW EXECUTE FUNCTION rdtr.guard_provenance()',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rdtr FROM PUBLIC, siap_izin_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA rdtr REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, siap_izin_readonly;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='rdtr' AND c.relkind='r' AND
   (has_table_privilege('siap_izin_readonly',c.oid,'INSERT') OR has_table_privilege('siap_izin_readonly',c.oid,'UPDATE')
    OR has_table_privilege('siap_izin_readonly',c.oid,'DELETE') OR has_table_privilege('siap_izin_readonly',c.oid,'TRUNCATE'))) THEN
  RAISE EXCEPTION 'Existing RDTR reader role inherits write privileges' USING ERRCODE='42501';
 END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['plan_version','zone_feature','zone_match_key','zone_display','local_activity','activity_zone_rule','rule_target','rule_evidence','kbli_activity_mapping','kbli_entry','source_artifact','dataset_release','release_plan_version','release_mapping'] LOOP
  EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON rdtr.%I FOR EACH STATEMENT EXECUTE FUNCTION rdtr.reject_mutation()',t);
 END LOOP;
END $$;
