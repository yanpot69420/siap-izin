"""Stage validated archived subsets in local PostGIS; never publish or fetch upstream."""
import hashlib,json,uuid
from dataclasses import fields

from psycopg.types.json import Jsonb
import dev_server as source
from rdtr_archive import store_artifact
from rdtr_snapshot import NormalizedSnapshot,read_snapshot_bytes


def _hash(value):
    return hashlib.sha256(source.encoded(value)).hexdigest()


def import_snapshot(conn,snapshot,blob_root,*,batch_key='initial-archived-subset'):
    """Caller retains any outer transaction. Blob may remain after DB rollback.

    This initial ingester accepts validated_source_cache artifacts, not full-layer
    HTTP archives. It does not publish a release, build display LOD or change the
    legacy live adapter. Source times remain the archived acquisition times.
    """
    if conn.info.dbname not in ('siap_izin_dev','siap_izin_test') or conn.info.host!='127.0.0.1' or conn.info.port!=54339:
        raise ValueError('isolated_local_database_required')
    if not isinstance(snapshot,NormalizedSnapshot):
        raise ValueError('validated_snapshot_required')
    if not isinstance(batch_key,str) or not batch_key or len(batch_key)>200:
        raise ValueError('invalid_import_batch_key')
    validated=read_snapshot_bytes(snapshot.raw_bytes,expected_sha256=snapshot.artifact_sha256,expected_plan_id=snapshot.plan_id)
    # Canonical JSON distinguishes 7/7.0 and False/0, unlike Python tree equality.
    # Only shallow field dictionaries are built; no coordinate tree is copied.
    view={f.name:getattr(snapshot,f.name) for f in fields(NormalizedSnapshot) if f.name!='raw_bytes'}
    authoritative={f.name:getattr(validated,f.name) for f in fields(NormalizedSnapshot) if f.name!='raw_bytes'}
    try:
        matches=_hash(view)==_hash(authoritative)
    except (TypeError,ValueError,RecursionError,OverflowError):
        raise ValueError('snapshot_mutated') from None
    if not matches:
        raise ValueError('snapshot_mutated')
    snapshot=validated
    blob=store_artifact(snapshot.raw_bytes,blob_root)
    if blob['sha256']!=snapshot.artifact_sha256:
        raise ValueError('artifact_identity_mismatch')
    registry=json.loads(source.CATALOG_BYTES)
    region=next(r for r in registry['regions'] if r['id']==snapshot.region_id)
    ctx=snapshot.layer_context
    source_filter={'field':snapshot.activity['filterField'],'values':snapshot.filter_zone_codes,'kbli':snapshot.kbli,'scope':'filtered_subset'}
    with conn.transaction():
        conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',('siap-izin-import:'+snapshot.plan_id,))
        conn.execute('INSERT INTO rdtr.geo_region(name,id_namespace,source_region_id) VALUES(%s,%s,%s) ON CONFLICT(id_namespace,source_region_id) DO NOTHING',(region['name'],'gistaru',snapshot.region_id))
        region_id=conn.execute('SELECT id FROM rdtr.geo_region WHERE id_namespace=%s AND source_region_id=%s',('gistaru',snapshot.region_id)).fetchone()[0]
        conn.execute('INSERT INTO rdtr.rdtr_plan(region_id,source_provider,source_plan_id,name,catalog_state,source_metadata) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(source_provider,source_plan_id) DO NOTHING',(region_id,'gistaru',snapshot.plan_id,snapshot.plan_name,'listed',Jsonb({'catalogStatus':'curated_source_snapshot','catalogCheckedAt':registry['checkedAt']})))
        plan_id=conn.execute('SELECT id FROM rdtr.rdtr_plan WHERE source_provider=%s AND source_plan_id=%s',('gistaru',snapshot.plan_id)).fetchone()[0]
        run_id=conn.execute('''INSERT INTO rdtr.import_run(plan_id,batch_key,status,retrieval_scope,source_filter,expected_id_count,received_id_count,valid_count,quarantined_count,manifest_hash,validation_result)
          VALUES(%s,%s,'running','filtered_subset',%s,%s,%s,%s,%s,%s,%s) RETURNING id''',(plan_id,batch_key,Jsonb(source_filter),snapshot.counts['matched'],snapshot.counts['matched'],len(snapshot.features),len(snapshot.quarantine),snapshot.artifact_sha256,Jsonb({'artifactKind':'validated_source_cache','officialNetworkCheck':False}))).fetchone()[0]
        artifact_id=conn.execute('''INSERT INTO rdtr.source_artifact(import_run_id,kind,public_url,retrieved_at,sha256,byte_size,blob_locator,mime_type,source_time)
          VALUES(%s,'validated_source_cache',%s,%s,%s,%s,%s,'application/json',%s) RETURNING id''',(run_id,snapshot.source_metadata['geometryQueryUrl'],snapshot.source_observed_at,blob['sha256'],blob['size_bytes'],blob['blob_locator'],snapshot.source_observed_at)).fetchone()[0]
        for index,item in enumerate(snapshot.quarantine):
            oid=item['object_id']
            if type(oid) is not int or oid<0:
                raise ValueError('invalid_quarantined_object_id')
            conn.execute('''INSERT INTO rdtr.quarantined_feature(import_run_id,source_artifact_id,source_object_id,feature_locator,error_code,reason) VALUES(%s,%s,%s,%s,'source_geometry_invalid',%s)''',(run_id,artifact_id,oid,'/data/quarantine/'+str(index),item['reason']))
        existing=conn.execute('SELECT id FROM rdtr.plan_version WHERE plan_id=%s AND content_fingerprint=%s',(plan_id,snapshot.content_fingerprint)).fetchone()
        if existing:
            version_id=existing[0]
            conn.execute("UPDATE rdtr.import_run SET status='ready',completed_at=now() WHERE id=%s",(run_id,))
            conn.execute('''INSERT INTO rdtr.plan_observation(plan_version_id,import_run_id,result,validation_result) VALUES(%s,%s,'content_same',%s)''',(version_id,run_id,Jsonb({'kind':'archived_snapshot_validation','officialNetworkCheck':False})))
            return {'run_id':str(run_id),'plan_id':snapshot.plan_id,'plan_version_id':str(version_id),'created_version':False,'valid_features':len(snapshot.features),'quarantined_features':len(snapshot.quarantine),'geometry_scope':'filtered_subset','rules_scope':'filter_membership_only','source_kind':'local_dataset','source_observed_at':snapshot.source_observed_at,'artifact_sha256':blob['sha256'],'published':False}
        version_id=conn.execute('''INSERT INTO rdtr.plan_version(plan_id,created_from_run_id,content_fingerprint,layer_path,source_provider,native_srid,output_srid,layer_metadata,geometry_scope,rules_scope,ingest_state,freshness_state,source_filter,coverage,source_id_count,valid_feature_count,quarantined_feature_count,ids_reconciled,source_time)
          VALUES(%s,%s,%s,%s,'gistaru',%s,4326,%s,'filtered_subset','filter_membership_only','pending','dated_snapshot',%s,%s,%s,%s,%s,true,%s) RETURNING id''',(plan_id,run_id,snapshot.content_fingerprint,ctx['service_path']+'/'+str(ctx['sublayer']),snapshot.source_metadata['nativeWkid'],Jsonb({'context':ctx,'artifactKind':'validated_source_cache','attributesKind':'sanitized_source_projection'}),Jsonb(source_filter),Jsonb({'scope':'loaded-plan-matching-zones-only','mappingReviewed':False}),snapshot.counts['matched'],len(snapshot.features),len(snapshot.quarantine),snapshot.source_observed_at)).fetchone()[0]
        activity_id=conn.execute('''INSERT INTO rdtr.local_activity(plan_version_id,source_activity_id,name,source_payload,source_artifact_id,source_locator) VALUES(%s,%s,%s,%s,%s,%s) RETURNING id''',(version_id,snapshot.activity['id'],snapshot.activity['name'],Jsonb(snapshot.activity),artifact_id,'/data/payload/meta/activity')).fetchone()[0]
        feature_rows=[];key_rows=[]
        for index,feature in enumerate(snapshot.features):
            p=feature['properties'];oid=p['object_id']
            if type(oid) is not int or oid<0:
                raise ValueError('invalid_source_object_id')
            feature_id=uuid.uuid4();geometry=source.encoded(feature['geometry'])
            feature_rows.append((feature_id,version_id,oid,p['zone_code'],p['zone_name'],Jsonb(p),artifact_id,'/data/payload/features/'+str(index),geometry.decode('utf-8'),hashlib.sha256(geometry).hexdigest(),_hash(p)))
            key_rows.append((version_id,feature_id,snapshot.activity['filterField'],p['filter_value']))
        with conn.cursor() as cursor:
            cursor.executemany('''INSERT INTO rdtr.zone_feature(id,plan_version_id,source_object_id,zone_code,zone_name,source_properties,source_artifact_id,feature_locator,geom_original_4326,geometry_hash,properties_hash) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,public.ST_GeomFromGeoJSON(%s),%s,%s)''',feature_rows)
            cursor.executemany('INSERT INTO rdtr.zone_match_key(plan_version_id,zone_feature_id,field_name,raw_value) VALUES(%s,%s,%s,%s)',key_rows)
        rule_id=conn.execute('''INSERT INTO rdtr.activity_zone_rule(plan_version_id,local_activity_id,evidence_kind,permission_status,review_state,source_locator,source_payload) VALUES(%s,%s,'filter_membership','unknown','unreviewed',%s,%s) RETURNING id''',(version_id,activity_id,'/data/payload/meta/filterZoneCodes',Jsonb({'filterField':snapshot.activity['filterField'],'filterZoneCodes':snapshot.filter_zone_codes,'kind':'validated_cache_projection_not_itbx_matrix'}))).fetchone()[0]
        with conn.cursor() as cursor:
            cursor.executemany('INSERT INTO rdtr.rule_target(plan_version_id,rule_id,field_name,raw_value) VALUES(%s,%s,%s,%s)',[(version_id,rule_id,snapshot.activity['filterField'],v) for v in snapshot.filter_zone_codes])
        conn.execute('''INSERT INTO rdtr.rule_evidence(plan_version_id,rule_id,source_artifact_id,kind,locator,scope_kind,scope_payload) VALUES(%s,%s,%s,'filter_membership',%s,'unknown',%s)''',(version_id,rule_id,artifact_id,'/data/payload/meta/filterZoneCodes',Jsonb({'permission':'unknown','isFullRuleMatrix':False})))
        conn.execute('''INSERT INTO rdtr.kbli_entry(kbli_version,kbli_code,description,source_reference,scope) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(kbli_version,kbli_code) DO NOTHING''',(snapshot.kbli['version'],snapshot.kbli['code'],'Uraian belum diimpor dari katalog KBLI','validated_source_cache:meta.kbli; bukan impor katalog KBLI',Jsonb({'descriptionStatus':'not_imported'})))
        conn.execute('''INSERT INTO rdtr.kbli_activity_mapping(plan_version_id,local_activity_id,kbli_version,kbli_code,basis,scope_key,scope,assumptions,review_state) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,'unreviewed')''',(version_id,activity_id,snapshot.kbli['version'],snapshot.kbli['code'],'Calon relasi prototipe; belum review exact-KBLI',snapshot.kbli['scope'],Jsonb(snapshot.kbli),Jsonb({'scopeConfirmed':False,'permission':'unknown'})))
        conn.execute("UPDATE rdtr.plan_version SET ingest_state='ready' WHERE id=%s",(version_id,))
        conn.execute("UPDATE rdtr.import_run SET status='ready',completed_at=now() WHERE id=%s",(run_id,))
        conn.execute('''INSERT INTO rdtr.plan_observation(plan_version_id,import_run_id,result,validation_result) VALUES(%s,%s,'content_changed',%s)''',(version_id,run_id,Jsonb({'kind':'archived_snapshot_validation','officialNetworkCheck':False})))
    return {'run_id':str(run_id),'plan_id':snapshot.plan_id,'plan_version_id':str(version_id),'created_version':True,'valid_features':len(snapshot.features),'quarantined_features':len(snapshot.quarantine),'geometry_scope':'filtered_subset','rules_scope':'filter_membership_only','source_kind':'local_dataset','source_observed_at':snapshot.source_observed_at,'artifact_sha256':blob['sha256'],'published':False}
