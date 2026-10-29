# RDTR SQL/import contract

Implementation: `db/migrations/001_rdtr.sql` plus additive `002_provenance_parent_identity.sql`, `003_master_source_identity.sql` and `004_quarantine_publication_seal.sql`; namespace `rdtr` (20 content tables plus `schema_migration`). These files do not themselves change the application adapter or source pipeline. This contract supplements, rather than replaces, `rdtr-database.md`.

## Python entry point / transaction ownership

```python
from tools.rdtrdb.migrations import migrate
applied = migrate(conn)  # fresh: ['001_rdtr', '002_provenance_parent_identity', '003_master_source_identity', '004_quarantine_publication_seal']; repeat: []
```

Psycopg 3 connection; no credentials/environment discovery in this module. Migrations are ordered by filename, SHA-256 over exact file bytes, recorded as filename stems. One transaction + transaction-scoped advisory lock covers DDL and bookkeeping; an enclosing caller transaction retains commit/rollback ownership. Changed or missing applied migrations fail closed with `MigrationError`; SQL failures expose SQLSTATE, not SQL/DSNs/data. Do not edit an applied migration: add a new numbered file. Owner needs PostGIS extension/role creation privileges on initial application; an unsafe pre-existing reader role causes failure, not silent alteration.

Development application state is recorded separately in [the checkpoint](rdtr-db-foundation.md). Repository presence or test success alone does not establish deployment. Migrations001–004 are now read back in development; existing001–003 bytes remain unchanged. Migration004 preflights published origin-run quarantine counts without repair, locks both tables, and seals insert/update/delete/reparent/truncate of published-origin quarantine while preserving later observation-run inserts. Nonempty quarantine participates in preparation proofs; empty-quarantine v1 hashes remain compatible.

## Common conventions

- UUID primary `id` defaults to `gen_random_uuid()` except link tables/KBLI/activation. Explicit deterministic UUIDs are accepted.
- Source identifiers/codes are **literal text**: no trim, numeric conversion, inferred official namespace or zero stripping. `kbli_code` is exactly five ASCII digits; source plan/activity IDs are nonempty when present. Importer must validate source input types **before SQL binding**: PostgreSQL assignment casts cannot recover whether a supplied bigint/text originated as a JSON string or number. OID must be an integer, not bool/string/float, and nonnegative.
- Hash columns use lowercase 64-character SHA-256 hex. JSON columns default to empty object unless specified; original properties/payloads must not be replaced by interpreted summaries.
- Nullable counts mean **unknown**, not zero. All counts are nonnegative. `geometry_scope`: `complete_layer|filtered_subset|none|unknown`; `rules_scope`: `source_matrix|filter_membership_only|partial|missing|unknown`; `ingest_state`: `ready|partial|failed|pending`. Full-layer claims require ID reconciliation and explicit source/valid/quarantine counts.
- Review remains `unreviewed`, permission/evidence scope remains `unknown` unless positively evidenced. `filter_membership` cannot assert a known permission category. No claim of OSS approval or live freshness.

## Authoritative columns (required INSERT fields bold)

`id` and timestamps generally default; bold excludes those defaults. Use `psycopg.types.json.Jsonb` for Python JSON values.

| Table | Columns |
|---|---|
| `geo_region` | id, **name, id_namespace**, source_region_id |
| `rdtr_plan` | id, **region_id, source_provider, name**, source_plan_id, catalog_state=`unknown`, source_metadata |
| `import_run` | id, **plan_id, batch_key**, status=`pending`, started_at, completed_at, query_template, query_parameters, retrieval_scope=`unknown`, source_filter, expected_id_count, received_id_count, valid_count, quarantined_count, failure_reason, manifest_hash, validation_result |
| `source_artifact` | id, **import_run_id, kind, sha256, byte_size, blob_locator**, public_url, request_parameters, retrieved_at, http_status, mime_type, source_time |
| `plan_version` | id, **plan_id, created_from_run_id, content_fingerprint, layer_path**, source_provider, native_srid, output_srid=4326, field_definitions=`[]`, layer_metadata, geometry_scope=`unknown`, rules_scope=`unknown`, ingest_state=`pending`, freshness_state=`unchecked_since_import`, source_filter, coverage, source_id_count, valid_feature_count, quarantined_feature_count, ids_reconciled=false, source_time, regulation_effective_date, created_at, published_at |
| `plan_observation` | id, **plan_version_id, import_run_id, result**, observed_at, validation_result; result=`content_same|content_changed` |
| `zone_feature` | id, **plan_version_id, source_object_id, geom_original_4326**, zone_code, zone_name, subzone_code, subzone_name, source_properties, source_artifact_id, feature_locator, bounds (generated; do not INSERT), geometry_hash, properties_hash |
| `quarantined_feature` | id, **import_run_id, source_artifact_id, feature_locator, error_code, reason**, source_object_id, details |
| `zone_match_key` | **plan_version_id, zone_feature_id, field_name, raw_value** (all four form PK) |
| `zone_display` | **plan_version_id, zone_feature_id, level, algorithm_version, source_geometry_hash, method, geom_display_4326**, parameters, fallback_reason, qc_state=`unknown`, qc_result; PK=(version,feature,level,algorithm) |
| `local_activity` | id, **plan_version_id, source_activity_id, name**, source_payload, source_artifact_id, source_locator |
| `activity_zone_rule` | id, **plan_version_id, local_activity_id**, evidence_kind=`unknown`, raw_category (JSONB nullable), permission_status=`unknown`, conditions_text, conditions_payload, source_locator, review_state=`unreviewed`, source_payload |
| `rule_target` | **plan_version_id, rule_id, field_name, raw_value**, additional_scope; first four form PK |
| `rule_evidence` | id, **plan_version_id, rule_id, source_artifact_id, locator**, kind=`unknown`, scope_kind=`unknown`, scope_payload, source_payload |
| `kbli_entry` | **kbli_version, kbli_code, description**, source_reference, scope; PK=(version,code) |
| `kbli_activity_mapping` | id, **plan_version_id, local_activity_id, kbli_version, kbli_code, basis**, scope_key=`unknown`, scope, assumptions, revision=1, reviewer, reviewed_at, review_state=`unreviewed`, published_at, created_at |
| `dataset_release` | id, **manifest_hash**, schema_version=`001_rdtr`, status=`draft`, source_kind=`local_dataset`, created_at, published_at, published_by, coverage_notes, manifest, partial_release=false |
| `release_plan_version` | **release_id, plan_id, plan_version_id**, geometry_scope=`unknown`, rules_scope=`unknown`, ingest_state=`pending`, mapping_review_state=`not_available`, freshness_state=`unchecked_since_import`, known_available_feature_count, coverage; PK=(release,plan) |
| `release_mapping` | **release_id, mapping_id, plan_id, plan_version_id**; PK=(release,mapping) |
| `active_release` | **channel, release_id, activated_by**, activated_at; PK=channel |

## Insert order / filtered-subset seed

1. Region → plan → import run (`retrieval_scope='filtered_subset'`, retain original filter/time) → verbatim private artifacts (archive bytes and checksum first).
2. Draft plan version (`geometry_scope='filtered_subset'`, `rules_scope='filter_membership_only'`, native/output CRS distinct; source_time only if actually known). `created_from_run_id` must belong to that plan.
3. Activities, original features/attrs, quarantine, match keys → rules, rule targets/evidence → KBLI entries/mapping revisions → LOD. Unknown categories stay unknown; raw source category goes in `raw_category`/`source_payload`.
4. Record counts/validation and observation; same semantic content reuses existing `(plan_id,content_fingerprint)` version and adds an observation/run/artifacts rather than mutating published content. Artifact IDs are not globally deduplicated: provenance belongs to a retrieval run.
5. Initial ingestion need **not** publish/activate. If explicitly publishing: finish LOD/QC, set version `ingest_state='ready'` and `published_at`; seal selected mappings with `published_at`; create draft release + honest member scopes/states, pin mappings, then set release `status='published',published_at=...`. Finally INSERT/UPDATE the channel pointer in the same transaction. Activation timestamp/actor live on pointer, not mutable release metadata.

## Hard integrity and access boundaries

- Uniques: provider/source-plan ID, plan/fingerprint, version/source OID, version/source activity ID, and version/activity/KBLI/scope/revision. Same OID/activity literal may recur in another version.
- Composite feature/activity/rule/mapping FKs reject cross-version references. Release plan/version must match; release mapping must refer both to that exact membership and a mapping of that version. Two revisions of one logical KBLI/activity/scope relation cannot coexist in a release, even if draft edits introduce the conflict.
- Geometries: only valid, nonempty, 2D Polygon/MultiPolygon with SRID 4326 and world bounds; no implicit repair/rounding or geometry replacement. `bounds` is generated from original geometry. GiST indexes exist on original/display geometry; match/target/KBLI/version indexes support local queries. SQL typmods reject wrong SRID.
- Evidence/feature/activity artifact provenance and observations cannot cross plans. Quarantine artifact/run is composite-FK bound. Archive rows are append-only. Private blob locators, URLs and parameters must omit credentials/tokens/cookies; do not expose raw columns through browser SELECT-all.
- 002 freezes `import_run.plan_id` and `plan_version.(plan_id,created_from_run_id)` from creation, including drafts. Later same-plan observations and status/count/validation changes remain legal. A locked preflight rejects existing inconsistent provenance without repair.
- 003 freezes plan `(source_provider,source_plan_id,region_id)` and region `(id_namespace,source_region_id)` from INSERT. NULL and leading-zero text are identities, not values to normalize/fill later. New identities need new masters; same-value updates, names, catalog metadata/state and import progress remain legal. Known `validated_source_cache` context, when present, must have string IDs matching bound masters and `gistaru` provider/namespace, including the version provider. Contradictions fail closed with SQLSTATE `23503`; missing/unmarked historical context is not inferred or repaired. These guards cover ordinary SQL, not owner/superuser DDL or disabled triggers.
- Published versions, their child content, published mapping revisions and referenced KBLI content reject UPDATE/DELETE (children also reject INSERT/reparenting). Published releases and their memberships reject all mutation. TRUNCATE is blocked on protected content. This protects normal SQL writes, not an owner/superuser disabling triggers or changing DDL.
- `active_release` alone is switchable/rollbackable and can reference only published releases. Publication requires prepared versions with QC-passed/fallback display geometry and matching known feature counts; member scope/state must agree with the version. Blob existence, source-ID reconciliation, semantic hash computation and QC truth still require importer/operator validation.
- Global `siap_izin_readonly` is NOLOGIN, created only if absent, receives schema USAGE and table SELECT, never write/create rights. No login password or application role membership is created here. Unsafe pre-existing identity/inherited writes fail migration. Public/function privileges are revoked in `rdtr`; future owner-created tables inherit SELECT-only reader defaults.

## Integration tests

`.venv/bin/python -m unittest discover -s tests -p test_rdtr_db_schema.py -v`

Use `RDTR_TEST_DSN` or private `private/rdtr-db/connection.json:test_dsn`; absence explicitly skips. Config/DSNs never belong in output. Actual database name must be **siap_izin_test** before any fixture DDL. Each fixture drops **only rdtr inside a rolled-back transaction**, restoring any pre-existing schema on completion; no database reset. Statements have 15-second and locks 5-second test timeouts (lock worker: 8 seconds). Private RED/GREEN evidence is under `outputs/siap-izin-database-foundation/schema/`. Foundation acceptance: **19 real integration tests passed, zero skipped** in `16-final-green.log`; missing-configuration skip was also exercised separately. Column contract is frozen for the initial importer; further changes need explicit coordination and a later migration after application.
