"""Offline preparation and immutable release publication; caller owns transaction.

No HTTP, live-cache freshness checks, source-coordinate edits, or review promotion.
"""
import hashlib
import os
from pathlib import Path
import re
import stat
from types import SimpleNamespace
import uuid
from datetime import datetime

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import dev_server as source
from display_geometry import DisplayService, LEVELS
from rdtr_snapshot import MAX_SNAPSHOT_BYTES, read_snapshot_bytes

ALGORITHM = 'coverage-lod-v1'
LEVEL_IDS = {'overview': 0, 'regional': 1, 'detail': 2}


def _hash(value):
    return hashlib.sha256(source.encoded(value)).hexdigest()


def _guard(conn):
    if (conn.info.dbname not in ('siap_izin_dev', 'siap_izin_test') or
            conn.info.host != '127.0.0.1' or conn.info.port != 54339):
        raise ValueError('isolated_local_database_required')


def _uuid(value):
    if not isinstance(value, str) or re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', value) is None:
        raise ValueError('invalid_identifier')
    return value


def _one(conn, sql, params):
    with conn.cursor(row_factory=dict_row) as cur:
        return cur.execute(sql, params).fetchone()


def _capture(blob_root, artifact):
    """Pin every directory and the regular private leaf; decode captured bytes once."""
    path = Path(blob_root)
    locator = artifact['blob_locator']
    if '..' in path.parts or locator != artifact['sha256'] + '.json':
        raise ValueError('invalid_artifact_locator')
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open('/' if path.is_absolute() else '.', flags)
    try:
        for part in (path.parts[1:] if path.is_absolute() else path.parts):
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if info.st_uid != os.geteuid() or info.st_mode & 0o077:
            raise ValueError('private_archive_required')
        leaf = os.open(locator, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
        with os.fdopen(leaf, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or
                    info.st_mode & 0o077 or info.st_nlink != 1):
                raise ValueError('private_artifact_required')
            raw = stream.read(MAX_SNAPSHOT_BYTES + 1)
            if len(raw) != artifact['byte_size'] or len(raw) > MAX_SNAPSHOT_BYTES:
                raise ValueError('artifact_size_mismatch')
        return raw
    finally:
        os.close(fd)


def _version(conn, version_id):
    row = _one(conn, '''SELECT v.*,p.source_plan_id,p.name AS plan_name,
        g.source_region_id FROM rdtr.plan_version v
        JOIN rdtr.rdtr_plan p ON p.id=v.plan_id JOIN rdtr.geo_region g ON g.id=p.region_id
        WHERE v.id=%s FOR UPDATE OF v''', (version_id,))
    if row is None:
        raise ValueError('version_not_found')
    return row


def _reconcile(conn, version, snapshot):
    counts = snapshot.counts
    quarantined = conn.execute('''SELECT q.source_object_id,q.reason,q.feature_locator,q.error_code,
        q.details,a.sha256,a.kind FROM rdtr.quarantined_feature q
        JOIN rdtr.source_artifact a ON a.id=q.source_artifact_id
        WHERE q.import_run_id=%s ORDER BY q.source_object_id''', (version['created_from_run_id'],)).fetchall()
    expected_quarantine = sorted((q['object_id'], q['reason'], '/data/quarantine/' + str(index),
        'source_geometry_invalid', {}, snapshot.artifact_sha256, 'validated_source_cache')
        for index, q in enumerate(snapshot.quarantine))
    if quarantined != expected_quarantine:
        raise ValueError('source_sql_mismatch')
    if (version['content_fingerprint'] != snapshot.content_fingerprint or
            version['source_region_id'] != snapshot.region_id or
            version['layer_metadata'].get('context') != snapshot.layer_context or
            version['source_time'] != datetime.fromisoformat(snapshot.source_observed_at.replace('Z', '+00:00')) or
            version['native_srid'] != snapshot.source_metadata['nativeWkid'] or
            version['layer_path'] != snapshot.layer_context['service_path'] + '/' + str(snapshot.layer_context['sublayer']) or
            version['geometry_scope'] != 'filtered_subset' or
            version['rules_scope'] != 'filter_membership_only' or
            not version['ids_reconciled'] or
            (version['source_id_count'], version['valid_feature_count'], version['quarantined_feature_count']) !=
            (counts['matched'], counts['returned'], counts['excludedInvalid'])):
        raise ValueError('source_sql_mismatch')
    rows = conn.execute('''SELECT source_object_id,source_properties,geometry_hash,properties_hash,
        ST_AsEWKB(geom_original_4326),zone_code,zone_name FROM rdtr.zone_feature
        WHERE plan_version_id=%s ORDER BY source_object_id''', (version['id'],)).fetchall()
    expected = sorted(snapshot.features, key=lambda f: f['id'])
    if len(rows) != len(expected):
        raise ValueError('source_sql_mismatch')
    for row, feature in zip(rows, expected):
        props, geom = feature['properties'], feature['geometry']
        original = conn.execute('SELECT ST_AsEWKB(ST_GeomFromGeoJSON(%s))',
                                (source.encoded(geom).decode(),)).fetchone()[0]
        if (row[0] != feature['id'] or _hash(row[1]) != _hash(props) or
                row[2] != _hash(geom) or row[3] != _hash(props) or row[4] != original or
                row[5:] != (props['zone_code'], props['zone_name'])):
            raise ValueError('source_sql_mismatch')
    keys = conn.execute('''SELECT f.source_object_id,k.field_name,k.raw_value FROM rdtr.zone_match_key k
        JOIN rdtr.zone_feature f ON f.id=k.zone_feature_id WHERE k.plan_version_id=%s
        ORDER BY f.source_object_id,k.field_name,k.raw_value''', (version['id'],)).fetchall()
    if keys != [(f['id'], snapshot.activity['filterField'], f['properties']['filter_value']) for f in expected]:
        raise ValueError('source_sql_mismatch')
    activities = conn.execute('SELECT source_activity_id,name,source_payload FROM rdtr.local_activity WHERE plan_version_id=%s',
                              (version['id'],)).fetchall()
    if activities != [(snapshot.activity['id'], snapshot.activity['name'], snapshot.activity)]:
        raise ValueError('source_sql_mismatch')
    targets = conn.execute('''SELECT t.field_name,t.raw_value FROM rdtr.rule_target t
        JOIN rdtr.activity_zone_rule r ON r.id=t.rule_id
        WHERE t.plan_version_id=%s ORDER BY t.field_name,t.raw_value''', (version['id'],)).fetchall()
    if targets != sorted((snapshot.activity['filterField'], code) for code in snapshot.filter_zone_codes):
        raise ValueError('source_sql_mismatch')


def _source_rows_hash(conn, version_id):
    """Small private proof over SQL source content, not a substitute for byte reconciliation."""
    content = {}
    for table in ('zone_feature', 'zone_match_key', 'local_activity', 'activity_zone_rule', 'rule_target', 'rule_evidence'):
        content[table] = conn.execute(
            'SELECT to_jsonb(t) FROM rdtr.' + table + ' t WHERE plan_version_id=%s ORDER BY to_jsonb(t)::text',
            (version_id,)).fetchall()
    # Omit the key for q0: existing real preparations retain the exact v1 hash.
    # Any nonempty quarantine binds its full SQL identity, provenance and payload.
    quarantine = conn.execute('''SELECT to_jsonb(q) FROM rdtr.quarantined_feature q
        JOIN rdtr.plan_version v ON v.created_from_run_id=q.import_run_id
        WHERE v.id=%s ORDER BY to_jsonb(q)::text''', (version_id,)).fetchall()
    if quarantine:
        content['quarantined_feature'] = quarantine
    content['version'] = conn.execute('''SELECT jsonb_build_object('sourceTime',extract(epoch from source_time),
        'nativeSrid',native_srid,'outputSrid',output_srid,'geometryScope',geometry_scope,
        'rulesScope',rules_scope,'sourceFilter',source_filter,'layerPath',layer_path)
        FROM rdtr.plan_version WHERE id=%s''', (version_id,)).fetchone()[0]
    return _hash(content)


def prepare_version(conn, version_id, blob_root):
    """Build all three display-only levels from checksum-validated original bytes."""
    _guard(conn)
    _uuid(version_id)
    with conn.transaction():
        version = _version(conn, version_id)
        artifact = _one(conn, '''SELECT * FROM rdtr.source_artifact
            WHERE import_run_id=%s AND kind='validated_source_cache' ORDER BY id''',
            (version['created_from_run_id'],))
        if artifact is None:
            raise ValueError('source_artifact_missing')
        raw = _capture(blob_root, artifact)
        snapshot = read_snapshot_bytes(raw, artifact['sha256'], version['source_plan_id'])
        _reconcile(conn, version, snapshot)
        meta = {
            'plan': {'id': snapshot.plan_id, 'name': snapshot.plan_name, 'regionId': snapshot.region_id},
            'activity': snapshot.activity, 'kbli': snapshot.kbli,
            'filterZoneCodes': snapshot.filter_zone_codes, 'counts': snapshot.counts,
            'coverage': 'loaded-plan-matching-zones-only', 'geometryPurpose': 'display',
            'limitations': source.LIMITATIONS.copy(),
            'source': {key: snapshot.source_metadata[key] for key in (
                'status', 'retrievedAt', 'activitiesUrl', 'metadataUrl', 'geometryQueryUrl',
                'nativeWkid', 'outputWkid')}}
        payload = {'type': 'FeatureCollection', 'features': snapshot.features, 'meta': meta}
        service = DisplayService(SimpleNamespace(context=source.context_for(snapshot.plan_id)))
        service._snapshot(payload)
        model = {'schemaVersion': 1, 'algorithmVersion': ALGORITHM, 'meta': meta,
                 'sourceBounds': service._bounds, 'levels': {}}
        features = {row[0]: (row[1], row[2]) for row in conn.execute(
            'SELECT source_object_id,id,geometry_hash FROM rdtr.zone_feature WHERE plan_version_id=%s',
            (version_id,)).fetchall()}
        rows = []
        for name, level in LEVEL_IDS.items():
            built, info = service._build_level(payload, name)
            model['levels'][name] = info
            for feature in built:
                feature_id, geometry_hash = features[feature['id']]
                rows.append((version_id, feature_id, level, ALGORITHM, geometry_hash, info['method'],
                             Jsonb({'toleranceMeters': LEVELS[name]}), info['fallbackReason'],
                             'passed' if info['method'] == 'coverage_simplify' else 'fallback',
                             Jsonb(dict(info['validation'])), source.encoded(feature['geometry']).decode()))
        model_hash = _hash(model)
        original_hashes = {str(row[0]): row[1] for row in conn.execute(
            "SELECT id,encode(sha256(ST_AsEWKB(geom_original_4326)),'hex') FROM rdtr.zone_feature WHERE plan_version_id=%s", (version_id,))}
        for row in rows:
            display_hash = conn.execute("SELECT encode(sha256(ST_AsEWKB(ST_GeomFromGeoJSON(%s))),'hex')", (row[-1],)).fetchone()[0]
            row[9].obj.update(modelHash=model_hash, contentFingerprint=version['content_fingerprint'], originalEWKBHash=original_hashes[str(row[1])],
                              displayEWKBHash=display_hash)
        existing = conn.execute('''SELECT zone_feature_id,level,source_geometry_hash,method,parameters,
            fallback_reason,qc_state,qc_result,ST_AsEWKB(geom_display_4326) FROM rdtr.zone_display
            WHERE plan_version_id=%s AND algorithm_version=%s ORDER BY level,zone_feature_id''',
            (version_id, ALGORITHM)).fetchall()
        proof = {'modelHash': model_hash, 'contentFingerprint': version['content_fingerprint'],
                 'sourceRowsHash': _source_rows_hash(conn, version_id)}
        reused = (version['layer_metadata'].get('localReadModel') == model and
                  version['layer_metadata'].get('localReadPreparation') == proof)
        if existing or reused or version['published_at'] is not None:
            expected = []
            for row in rows:
                geometry = conn.execute('SELECT ST_AsEWKB(ST_GeomFromGeoJSON(%s))', (row[-1],)).fetchone()[0]
                expected.append((row[1], row[2], row[4], row[5], row[6].obj, row[7], row[8], row[9].obj, geometry))
            expected.sort(key=lambda r: (r[1], r[0]))
            if not reused or existing != expected:
                raise ValueError('prepared_content_mismatch')
            return {'plan_version_id': version_id, 'algorithm_version': ALGORITHM,
                    'display_rows': len(rows), 'reused': True}
        with conn.cursor() as cur:
            cur.executemany('''INSERT INTO rdtr.zone_display(plan_version_id,zone_feature_id,level,
                algorithm_version,source_geometry_hash,method,parameters,fallback_reason,qc_state,
                qc_result,geom_display_4326) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                public.ST_GeomFromGeoJSON(%s))''', rows)
        conn.execute('UPDATE rdtr.plan_version SET layer_metadata=%s WHERE id=%s',
                     (Jsonb(dict(version['layer_metadata'], localReadModel=model, localReadPreparation=proof)), version_id))
        return {'plan_version_id': version_id, 'algorithm_version': ALGORITHM,
                'display_rows': len(rows), 'reused': False}


def _validate_prepared(conn, version):
    try:
        model = version['layer_metadata']['localReadModel']
        model_hash = _hash(model)
        meta = model['meta']
        count = version['valid_feature_count']
        quarantine_count = conn.execute('SELECT count(*) FROM rdtr.quarantined_feature WHERE import_run_id=%s',
                                        (version['created_from_run_id'],)).fetchone()[0]
        if (quarantine_count != version['quarantined_feature_count'] or
                version['layer_metadata'].get('localReadPreparation') !=
                {'modelHash': model_hash, 'contentFingerprint': version['content_fingerprint'],
                 'sourceRowsHash': _source_rows_hash(conn, version['id'])} or
                model['schemaVersion'] != 1 or model['algorithmVersion'] != ALGORITHM or
                set(model['levels']) != set(LEVEL_IDS) or not version['ids_reconciled'] or
                meta['counts'] != {'matched': version['source_id_count'], 'returned': count,
                                   'excludedInvalid': version['quarantined_feature_count']} or
                version['source_id_count'] != count + version['quarantined_feature_count'] or
                meta['source']['status'] != 'local_dataset'):
            raise ValueError()
        features = conn.execute('''SELECT id,geometry_hash,properties_hash,source_properties,
            encode(sha256(ST_AsEWKB(geom_original_4326)),'hex') FROM rdtr.zone_feature WHERE plan_version_id=%s''', (version['id'],)).fetchall()
        if len(features) != count:
            raise ValueError()
        for original in features:
            properties = original[3]
            # Match the reader's scalar contract before any immutable seal/write.
            if (not all(type(properties.get(key)) is str and 0 < len(properties[key]) <= 4000
                        for key in ('zone_code', 'zone_name', 'zone_group')) or
                    (properties.get('subzone_name') is not None and type(properties['subzone_name']) is not str)):
                raise ValueError()
        originals = {r[0]: r for r in features}
        properties_hashes = {r[0]: _hash(r[3]) for r in features}
        rows = conn.execute('''SELECT zone_feature_id,level,source_geometry_hash,method,parameters,
            fallback_reason,qc_state,qc_result,encode(sha256(ST_AsEWKB(geom_display_4326)),'hex'),ST_NPoints(geom_display_4326)
            FROM rdtr.zone_display WHERE plan_version_id=%s AND algorithm_version=%s''', (version['id'], ALGORITHM)).fetchall()
        if len(rows) != 3 * count:
            raise ValueError()
        for name, level in LEVEL_IDS.items():
            info = model['levels'][name]
            selected = [r for r in rows if r[1] == level]
            if (len(selected) != count or info['sourceFeatureCount'] != count or
                    info['returnedFeatureCount'] != count or info['level'] != name or
                    info['toleranceMeters'] != LEVELS[name] or
                    info['returnedVertices'] != sum(r[9] for r in selected)):
                raise ValueError()
            for row in selected:
                original = originals[row[0]]
                qc = row[7]
                if (row[2] != original[1] or original[2] != properties_hashes[row[0]] or
                        qc.get('modelHash') != model_hash or
                        qc.get('contentFingerprint') != version['content_fingerprint'] or
                        qc.get('originalEWKBHash') != original[4] or
                        qc.get('displayEWKBHash') != row[8] or
                        row[3] != info['method'] or row[4] != {'toleranceMeters': LEVELS[name]} or
                        row[5] != info['fallbackReason'] or
                        row[6] != ('passed' if info['method'] == 'coverage_simplify' else 'fallback') or
                        any(qc.get(k) != v for k, v in info['validation'].items())):
                    raise ValueError()
    except (KeyError, TypeError, ValueError):
        raise ValueError('preparation_invalid') from None


def _release_receipt(conn, release_id, digest, manifest, *, channel, activate, actor, reused):
    if activate:
        conn.execute('''INSERT INTO rdtr.active_release(channel,release_id,activated_by)
            VALUES(%s,%s,%s) ON CONFLICT(channel) DO UPDATE SET release_id=EXCLUDED.release_id,
            activated_by=EXCLUDED.activated_by,activated_at=now()''', (channel, release_id, actor))
    return {'release_id': str(release_id), 'release_hash': digest, 'manifest': manifest,
            'partial': True, 'activated': activate, 'reused': reused, 'plan_count': len(manifest['plans'])}


def publish_release(conn, selections, *, channel, activate, actor):
    """Publish explicitly selected mapping revisions; activation is opt-in only."""
    _guard(conn)
    if (type(activate) is not bool or not isinstance(channel, str) or
            re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', channel) is None or
            not isinstance(actor, str) or not actor.strip() or len(actor) > 200):
        raise ValueError('invalid_release_parameters')
    try:
        if not isinstance(selections, list) or not selections:
            raise ValueError()
        for selection in selections:
            if not isinstance(selection, dict) or set(selection) != {'plan_version_id', 'mapping_id'}:
                raise ValueError()
            _uuid(selection['plan_version_id'])
            _uuid(selection['mapping_id'])
    except (ValueError, TypeError, KeyError):
        raise ValueError('invalid_selections') from None
    with conn.transaction():
        members = []
        for selection in sorted(selections, key=lambda s: s['plan_version_id']):
            version = _version(conn, selection['plan_version_id'])
            _validate_prepared(conn, version)
            if version['valid_feature_count'] == 0 and version['source_id_count'] != 0:
                raise ValueError('no_publishable_features')
            mapping = _one(conn, 'SELECT * FROM rdtr.kbli_activity_mapping WHERE id=%s FOR UPDATE',
                           (selection['mapping_id'],))
            if (mapping is None or mapping['plan_version_id'] != version['id'] or
                    mapping['kbli_code'] != '01273' or mapping['kbli_version'] != '2025' or
                    mapping['scope_key'] != 'budidaya-kakao' or
                    any(v['plan_id'] == version['plan_id'] for v, _ in members)):
                raise ValueError('invalid_selections')
            if mapping['review_state'] != 'unreviewed' or version['freshness_state'] != 'dated_snapshot':
                raise ValueError('unsupported_publication_state')
            activity = conn.execute('SELECT source_activity_id FROM rdtr.local_activity WHERE id=%s AND plan_version_id=%s',
                                    (mapping['local_activity_id'], version['id'])).fetchone()
            if activity is None or activity[0] != version['layer_metadata']['localReadModel']['meta']['activity']['id']:
                raise ValueError('invalid_selections')
            members.append((version, mapping))
        manifest = {'schemaVersion': 1, 'sourceKind': 'local_dataset', 'algorithmVersion': ALGORITHM,
                    'partial': True, 'plans': sorted([{
                        'planId': v['source_plan_id'], 'planVersionId': str(v['id']),
                        'contentFingerprint': v['content_fingerprint'], 'mappingId': str(m['id']),
                        'mappingRevision': m['revision'], 'geometryScope': v['geometry_scope'],
                        'rulesScope': v['rules_scope']} for v, m in members], key=lambda p: p['planId'])}
        digest = _hash(manifest)
        conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', ('rdtr-release:' + digest,))
        existing = _one(conn, 'SELECT id,manifest,status FROM rdtr.dataset_release WHERE manifest_hash=%s ORDER BY id', (digest,))
        if existing:
            if existing['manifest'] != manifest or existing['status'] != 'published':
                raise ValueError('release_identity_conflict')
            return _release_receipt(conn, existing['id'], digest, manifest, channel=channel,
                                    activate=activate, actor=actor, reused=True)
        for v, m in members:
            if v['published_at'] is None:
                conn.execute("UPDATE rdtr.plan_version SET ingest_state='ready',published_at=now() WHERE id=%s", (v['id'],))
            if m['published_at'] is None:
                conn.execute('UPDATE rdtr.kbli_activity_mapping SET published_at=now() WHERE id=%s', (m['id'],))
        release_id = conn.execute('''INSERT INTO rdtr.dataset_release(manifest_hash,manifest,partial_release,
            coverage_notes,published_by) VALUES(%s,%s,true,%s,%s) RETURNING id''',
            (digest, Jsonb(manifest), 'Initial partial filtered subset; permission unknown; mapping unreviewed.', actor)).fetchone()[0]
        for v, m in members:
            conn.execute('''INSERT INTO rdtr.release_plan_version(release_id,plan_id,plan_version_id,
                geometry_scope,rules_scope,ingest_state,mapping_review_state,freshness_state,
                known_available_feature_count,coverage) VALUES(%s,%s,%s,%s,%s,'ready',%s,%s,%s,%s)''',
                (release_id, v['plan_id'], v['id'], v['geometry_scope'], v['rules_scope'], m['review_state'],
                 v['freshness_state'], v['valid_feature_count'], Jsonb(v['coverage'])))
            conn.execute('INSERT INTO rdtr.release_mapping(release_id,mapping_id,plan_id,plan_version_id) VALUES(%s,%s,%s,%s)',
                         (release_id, m['id'], v['plan_id'], v['id']))
        conn.execute("UPDATE rdtr.dataset_release SET status='published',published_at=now() WHERE id=%s", (release_id,))
        return _release_receipt(conn, release_id, digest, manifest, channel=channel,
                                activate=activate, actor=actor, reused=False)
