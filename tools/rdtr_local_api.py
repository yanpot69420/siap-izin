"""SQL-only, immutable-release local display reads. Caller owns the transaction.

No source transport, blob access, source geometry response, or LOD construction
is part of this module. An active pointer is consulted only by get_catalog.
"""
import copy
import hashlib
import json
import math
import re

from psycopg.rows import dict_row
from dev_server import APIError, CATALOG_BYTES, PLANS, encoded

ALGORITHM = 'coverage-lod-v1'
LEVELS = {'overview': (0, 100), 'regional': (1, 10), 'detail': (2, 1)}
HASH = re.compile(r'[0-9a-f]{64}')
PROPERTY_KEYS = ('object_id', 'plan_id', 'zone_name', 'zone_code', 'zone_group',
                 'subzone_name', 'filter_value', 'activity_id', 'activity_name')


def _require(condition, code='dataset_unavailable', status=503):
    if not condition:
        raise APIError(code, status)


def _rows(conn, sql, params=()):
    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(sql, params)
        return cursor.fetchall()


def _hash(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def _token(value):
    _require(type(value) is str and HASH.fullmatch(value), 'unsupported_query', 400)


def _snapshot(release_hash, member):
    return _hash({'releaseHash': release_hash, 'planVersionId': member['planVersionId'],
                  'mappingId': member['mappingId'], 'algorithmVersion': ALGORITHM})


def _release(conn, release_hash):
    _token(release_hash)
    rows = _rows(conn, """SELECT id::text AS id, manifest_hash, manifest, source_kind,
        partial_release, published_at FROM rdtr.dataset_release
        WHERE manifest_hash=%s AND status='published'""", (release_hash,))
    _require(rows, 'release_not_found', 404)
    _require(len(rows) == 1)
    release = rows[0]
    manifest = release['manifest']
    _require(type(manifest) is dict and _hash(manifest) == release_hash)
    _require(set(manifest) == {'schemaVersion','sourceKind','algorithmVersion','partial','plans'} and
             manifest['schemaVersion'] == 1 and manifest['sourceKind'] == 'local_dataset' and
             manifest['algorithmVersion'] == ALGORITHM and manifest['partial'] is True and
             release['source_kind'] == 'local_dataset' and release['partial_release'] is True and
             release['published_at'] is not None)
    rows = _rows(conn, """SELECT p.source_plan_id AS "planId", v.id::text AS "planVersionId",
        v.content_fingerprint AS "contentFingerprint", m.id::text AS "mappingId",
        m.revision AS "mappingRevision", v.geometry_scope AS "geometryScope",
        v.rules_scope AS "rulesScope", v.published_at AS version_published,
        m.published_at AS mapping_published, v.ingest_state, m.kbli_code, m.kbli_version,
        m.scope_key, m.review_state, a.source_activity_id, a.name AS activity_name,
        v.layer_metadata->'localReadModel' AS model, v.source_id_count,
        v.valid_feature_count, v.quarantined_feature_count, v.ids_reconciled,
        v.source_time, v.native_srid, v.freshness_state, v.id AS version_uuid,
        r.geometry_scope AS release_geometry_scope, r.rules_scope AS release_rules_scope,
        r.ingest_state AS release_ingest_state, r.freshness_state AS release_freshness_state,
        r.known_available_feature_count, r.mapping_review_state,
        p.source_provider, g.id_namespace, g.source_region_id
        FROM rdtr.release_plan_version r
        JOIN rdtr.plan_version v ON v.id=r.plan_version_id AND v.plan_id=r.plan_id
        JOIN rdtr.rdtr_plan p ON p.id=r.plan_id
        JOIN rdtr.geo_region g ON g.id=p.region_id
        LEFT JOIN rdtr.release_mapping rm ON rm.release_id=r.release_id
            AND rm.plan_id=r.plan_id AND rm.plan_version_id=r.plan_version_id
        LEFT JOIN rdtr.kbli_activity_mapping m ON m.id=rm.mapping_id AND m.plan_version_id=v.id
        LEFT JOIN rdtr.local_activity a ON a.id=m.local_activity_id AND a.plan_version_id=v.id
        WHERE r.release_id=%s ORDER BY p.source_plan_id,m.id""", (release['id'],))
    keys = ('planId','planVersionId','contentFingerprint','mappingId','mappingRevision','geometryScope','rulesScope')
    identities = [{key: row[key] for key in keys} for row in rows]
    _require(rows and manifest['plans'] == identities and
             len({r['planId'] for r in rows}) == len(rows))
    for row in rows:
        ctx = PLANS.get(row['planId'])
        _require(ctx is not None and ctx.activity_id is not None and row['source_provider']=='gistaru' and
                 row['id_namespace']=='gistaru' and row['source_region_id']==ctx.region_id and
                 row['version_published'] is not None and row['mapping_published'] is not None and
                 row['kbli_code']=='01273' and row['kbli_version']=='2025' and row['scope_key']=='budidaya-kakao' and
                 row['review_state']=='unreviewed' and row['mapping_review_state']=='unreviewed' and
                 row['source_activity_id']==ctx.activity_id and row['activity_name']==ctx.activity_name and
                 row['ingest_state']=='ready' and row['release_ingest_state']=='ready' and
                 row['geometryScope']==row['release_geometry_scope']=='filtered_subset' and
                 row['rulesScope']==row['release_rules_scope']=='filter_membership_only' and
                 row['freshness_state']==row['release_freshness_state']=='dated_snapshot')
        _require(type(row['model']) is dict and row['model'].get('schemaVersion')==1 and
                 row['model'].get('algorithmVersion')==ALGORITHM)
    release['members'] = {r['planId']: r for r in rows}
    for row in rows:
        _prepared(conn, row)
    return release


def _dataset(release, member=None):
    result = {'sourceKind':'local_dataset', 'releaseId':release['id'],
              'releaseHash':release['manifest_hash']}
    if member is None:
        result['partial'] = True
    else:
        result.update({k:member[k] for k in ('planVersionId','mappingId','geometryScope','rulesScope')})
    return result


def get_catalog(conn, channel='exploration'):
    _require(type(channel) is str and re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', channel), 'unsupported_query', 400)
    rows = _rows(conn, """SELECT d.manifest_hash FROM rdtr.active_release a
        JOIN rdtr.dataset_release d ON d.id=a.release_id WHERE a.channel=%s""", (channel,))
    _require(len(rows)==1)
    release = _release(conn, rows[0]['manifest_hash'])
    result = json.loads(CATALOG_BYTES)
    result['localDataset'] = _dataset(release)
    for plan in result['plans']:
        member = release['members'].get(plan['id'])
        local = {'available':False, 'releaseHash':release['manifest_hash']}
        if member:
            local.update(available=True, releaseId=release['id'], planVersionId=member['planVersionId'],
                         mappingId=member['mappingId'], snapshotId=_snapshot(release['manifest_hash'], member),
                         geometryScope=member['geometryScope'], rulesScope=member['rulesScope'])
        plan['localDataset'] = local
    return result

def _prepared(conn, member):
    """Fail closed if sealed read metadata no longer describes SQL inventory."""
    model, ctx = member['model'], PLANS[member['planId']]
    meta = model.get('meta')
    _require(type(meta) is dict)
    counts = meta.get('counts')
    _require(type(counts) is dict and set(counts)=={'matched','returned','excludedInvalid'} and
             all(type(n) is int and n>=0 for n in counts.values()))
    _require(member['ids_reconciled'] is True and
             (counts['matched'],counts['returned'],counts['excludedInvalid']) ==
             (member['source_id_count'],member['valid_feature_count'],member['quarantined_feature_count']) and
             counts['matched']==counts['returned']+counts['excludedInvalid'] and
             member['known_available_feature_count']==counts['returned'] and counts['returned']<=20000)
    expected = {
        'plan': {'id':ctx.id,'name':ctx.name,'regionId':ctx.region_id},
        'activity': {'id':ctx.activity_id,'name':ctx.activity_name,'filterField':ctx.filter_field,'mappingReviewed':False},
        'kbli': {'code':'01273','version':'2025','scope':'budidaya-kakao','scopeConfirmed':False,'mappingReviewed':False},
        'coverage':'loaded-plan-matching-zones-only', 'geometryPurpose':'display'}
    _require(all(meta.get(key)==value for key,value in expected.items()))
    codes, limitations, source = meta.get('filterZoneCodes'), meta.get('limitations'), meta.get('source')
    _require(type(codes) is list and
             all(type(c) is str and re.fullmatch(r'[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)*',c) for c in codes) and
             len(codes)==len(set(codes)))
    _require(type(limitations) is list and limitations and all(type(x) is str and 0<len(x)<=4000 for x in limitations))
    _require(type(source) is dict)
    expected_source = {'status':'local_dataset','activitiesUrl':ctx.activities_url,
                       'metadataUrl':ctx.metadata_url,'geometryQueryUrl':ctx.query_url,
                       'nativeWkid':ctx.native_wkid,'outputWkid':4326}
    _require(all(source.get(key)==value for key,value in expected_source.items()) and member['native_srid']==ctx.native_wkid)
    from datetime import datetime
    try:
        observed = datetime.fromisoformat(source['retrievedAt'].replace('Z','+00:00'))
        _require(observed.tzinfo is not None and observed==member['source_time'])
    except (KeyError, TypeError, ValueError, AttributeError):
        raise APIError('dataset_unavailable',503) from None
    inventory = _rows(conn, """SELECT count(*) AS n, coalesce(sum(ST_NPoints(geom_original_4326)),0) AS vertices,
        ST_XMin(ST_Extent(geom_original_4326)) AS w, ST_YMin(ST_Extent(geom_original_4326)) AS s,
        ST_XMax(ST_Extent(geom_original_4326)) AS e, ST_YMax(ST_Extent(geom_original_4326)) AS n_bound,
        count(*) FILTER (WHERE geometry_hash IS NULL OR source_object_id>9007199254740991) AS bad
        FROM rdtr.zone_feature WHERE plan_version_id=%s""", (member['version_uuid'],))[0]
    bounds = [inventory[k] for k in ('w','s','e','n_bound')] if inventory['n'] else None
    _require(inventory['n']==counts['returned'] and inventory['bad']==0 and
             inventory['vertices']<=2000000 and model.get('sourceBounds')==bounds)
    levels = model.get('levels')
    _require(type(levels) is dict and set(levels)==set(LEVELS))
    actual = _rows(conn, """SELECT d.level, count(*) AS n,
        coalesce(sum(ST_NPoints(d.geom_display_4326)),0) AS vertices,
        bool_and(d.source_geometry_hash=f.geometry_hash) AS hashes,
        bool_and(d.qc_state=CASE WHEN d.method='coverage_simplify' THEN 'passed' ELSE 'fallback' END) AS qc,
        bool_and(coalesce(d.qc_result->>'modelHash'=%s AND
            d.qc_result->>'originalEWKBHash'=encode(sha256(ST_AsEWKB(f.geom_original_4326)),'hex') AND
            d.qc_result->>'displayEWKBHash'=encode(sha256(ST_AsEWKB(d.geom_display_4326)),'hex'),false)) AS proof,
        array_agg(DISTINCT d.method) AS methods,
        array_agg(DISTINCT d.fallback_reason) AS reasons,
        jsonb_agg(DISTINCT d.parameters) AS parameters,
        jsonb_agg(DISTINCT jsonb_build_object('featureIdsPreserved',d.qc_result->'featureIdsPreserved',
            'geometryValid',d.qc_result->'geometryValid','coverageValid',d.qc_result->'coverageValid')) AS validation
        FROM rdtr.zone_display d JOIN rdtr.zone_feature f
            ON f.id=d.zone_feature_id AND f.plan_version_id=d.plan_version_id
        WHERE d.plan_version_id=%s AND d.algorithm_version=%s GROUP BY d.level""", (_hash(model),member['version_uuid'],ALGORITHM))
    by_level = {r['level']:r for r in actual}
    _require(set(by_level)==({0,1,2} if counts['returned'] else set()))
    for name,(number,tolerance) in LEVELS.items():
        info = levels[name]
        _require(type(info) is dict and set(info)=={'algorithmVersion','purpose','level','toleranceMeters','method','fallbackReason','sourceFeatureCount','returnedFeatureCount','originalVertices','returnedVertices','bbox','validation'})
        _require(info['algorithmVersion']==ALGORITHM and info['purpose']=='display-only-not-analysis-or-export' and
                 info['level']==name and info['toleranceMeters']==tolerance and info['bbox'] is None and
                 info['sourceFeatureCount']==info['returnedFeatureCount']==counts['returned'] and
                 info['originalVertices']==inventory['vertices'] and type(info['returnedVertices']) is int and
                 0<=info['returnedVertices']<=info['originalVertices'])
        validation = info['validation']
        _require(type(validation) is dict and set(validation)=={'featureIdsPreserved','geometryValid','coverageValid'} and
                 validation['featureIdsPreserved'] is True and validation['geometryValid'] is True and
                 (validation['coverageValid'] is True or validation['coverageValid'] is False or validation['coverageValid'] is None))
        if counts['returned']==0:
            _require(counts['matched']==0 and info['method']=='original_preserved' and
                     info['fallbackReason'] is None and validation['coverageValid'] is None and info['returnedVertices']==0)
            continue
        if info['method']=='coverage_simplify':
            _require(info['fallbackReason'] is None and validation['coverageValid'] is True)
        else:
            _require(info['method']=='original_preserved' and info['fallbackReason'] in ('coverage_invalid','quality_validation_failed') and info['returnedVertices']==info['originalVertices'])
        row = by_level[number]
        _require(row['n']==counts['returned'] and row['vertices']==info['returnedVertices'] and
                 row['hashes'] is True and row['qc'] is True and row['proof'] is True and row['methods']==[info['method']] and
                 row['reasons']==[info['fallbackReason']] and row['parameters']==[{'toleranceMeters':tolerance}] and
                 row['validation']==[validation])
    # Explicit response allowlists, including nested source metadata.
    member['base_meta'] = {**expected,'counts':copy.deepcopy(counts),'filterZoneCodes':copy.deepcopy(codes),
                           'limitations':copy.deepcopy(limitations),
                           'source':{**expected_source,'retrievedAt':source['retrievedAt']}}


def _member(conn, plan_id, release_hash):
    _require(type(plan_id) is str and plan_id in PLANS, 'unsupported_query',400)
    release = _release(conn,release_hash)
    member = release['members'].get(plan_id)
    _require(member is not None,'plan_not_in_release',422)
    return release,member


def _meta(release, member):
    meta = copy.deepcopy(member['base_meta'])
    meta.update(dataset=_dataset(release,member),snapshotId=_snapshot(release['manifest_hash'],member),
                sourceCounts=copy.deepcopy(meta['counts']), sourceBounds=copy.deepcopy(member['model']['sourceBounds']))
    return meta


def _bbox(bbox):
    if bbox is None:
        return None
    _require(type(bbox) in (list,tuple) and len(bbox)==4 and
             all(type(x) in (int,float) and math.isfinite(x) for x in bbox),'unsupported_query',400)
    w,s,e,n = bbox
    _require(-180<=w<e<=180 and -90<=s<n<=90,'unsupported_query',400)
    return list(bbox)


# Project attributes in SQL; never load source_properties wholesale, nor private
# artifact locators/paths or the original geometry into an API result.
_PROPERTY_SQL = "jsonb_build_object(" + ','.join(
    "'%s',f.source_properties->'%s'" % (key,key) for key in PROPERTY_KEYS) + ")"
_BOUNDS_SQL = "jsonb_build_array(ST_XMin(f.bounds),ST_YMin(f.bounds),ST_XMax(f.bounds),ST_YMax(f.bounds))"


def _properties(row, member, detail=False):
    p, ctx = row['properties'], PLANS[member['planId']]
    _require(p.get('object_id')==row['object_id'] and type(p.get('object_id')) is int and
             p.get('plan_id')==ctx.id and p.get('activity_id')==ctx.activity_id and
             p.get('activity_name')==ctx.activity_name and p.get('filter_value') in member['base_meta']['filterZoneCodes'] and
             all(type(p.get(k)) is str and 0<len(p[k])<=4000 for k in ('zone_code','zone_name','zone_group')) and
             (p.get('subzone_name') is None or type(p.get('subzone_name')) is str))
    _require(ctx.filter_field!='KODSZN' or p['filter_value']==p['zone_code'])
    p.update(permission='unknown',evidence_status='unreviewed_mapping',source_bounds=row['bounds'])
    if detail:
        _require(row['regulation'] is None or type(row['regulation']) is str)
        p['regulation']=row['regulation']
    return p


def _vertices(coordinates):
    if coordinates and isinstance(coordinates[0],(int,float)):
        return 1
    return sum(_vertices(child) for child in coordinates)


def get_display(conn, plan_id, level, release_hash, bbox=None):
    _require(type(level) is str and level in LEVELS,'unsupported_query',400)
    bbox = _bbox(bbox)
    release,member = _member(conn,plan_id,release_hash)
    sql = "SELECT f.source_object_id AS object_id," + _PROPERTY_SQL + " AS properties," + _BOUNDS_SQL + " AS bounds, ST_AsGeoJSON(d.geom_display_4326,17,0)::jsonb AS geometry FROM rdtr.zone_feature f JOIN rdtr.zone_display d ON d.zone_feature_id=f.id AND d.plan_version_id=f.plan_version_id WHERE f.plan_version_id=%s AND d.level=%s AND d.algorithm_version=%s"
    params = [member['version_uuid'],LEVELS[level][0],ALGORITHM]
    if bbox is not None:
        sql += ' AND ST_Intersects(f.geom_original_4326,ST_MakeEnvelope(%s,%s,%s,%s,4326))'
        params.extend(bbox)
    rows = _rows(conn,sql+' ORDER BY f.source_object_id',params)
    features = [{'type':'Feature','id':r['object_id'],'properties':_properties(r,member),'geometry':r['geometry']} for r in rows]
    meta = _meta(release,member)
    info = copy.deepcopy(member['model']['levels'][level])
    info.update(bbox=bbox,returnedFeatureCount=len(features),returnedVertices=sum(_vertices(f['geometry']['coordinates']) for f in features))
    meta['display']=info
    return {'type':'FeatureCollection','features':features,'meta':meta}


def get_feature_detail(conn, plan_id, object_id, snapshot_id, release_hash):
    _require(type(object_id) is int and 0<=object_id<=9007199254740991,'unsupported_query',400)
    _token(snapshot_id)
    release,member = _member(conn,plan_id,release_hash)
    snapshot = _snapshot(release_hash,member)
    _require(snapshot_id==snapshot,'snapshot_changed',409)
    rows = _rows(conn, 'SELECT f.source_object_id AS object_id,' + _PROPERTY_SQL +
                 ' AS properties,' + _BOUNDS_SQL + " AS bounds,f.source_properties->'regulation' AS regulation " +
                 'FROM rdtr.zone_feature f WHERE f.plan_version_id=%s AND f.source_object_id=%s',
                 (member['version_uuid'],object_id))
    _require(len(rows)==1,'feature_not_found',404)
    return {'schemaVersion':1,'planId':plan_id,'objectId':object_id,'snapshotId':snapshot,
            'properties':_properties(rows[0],member,detail=True),'sourceBounds':rows[0]['bounds'],
            'meta':_meta(release,member)}
