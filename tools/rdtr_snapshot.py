"""Offline codec for archived v2 RDTR filter-subset artifacts; no network or DB.

``read_snapshot(path, expected_sha256=None, expected_plan_id=None)`` captures one
bounded byte string, validates it and returns an ingestion value. SHA-256 of the
artifact identifies those exact bytes; the semantic fingerprint identifies content.
Neither value asserts a full layer, a reviewed KBLI mapping, or permission.
"""
from dataclasses import dataclass, field
from pathlib import Path
import hashlib
import re
from datetime import datetime

import dev_server as source


def _token(value, pattern, label):
    if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
        raise ValueError(label)
    return value


def _plan(value):
    _token(value, r'[0-9]{10}:[0-9]{3}', 'invalid_plan_id')
    try:
        return source.context_for(value)
    except source.APIError as error:
        raise ValueError('unsupported_plan_id') from error

MAX_SNAPSHOT_BYTES = 128 * 1024 * 1024


@dataclass(frozen=True)
class NormalizedSnapshot:
    """Validated archived subset for ingestion, not a live source response.

    ``layer_context`` is the complete pinned catalog context (including the
    selected layer, native CRS and activity). ``source_observed_at`` is the exact
    archived acquisition string, never the local read time. ``source_metadata``
    labels this read local_dataset and retains originalSourceStatus. ``raw_bytes``
    is the authoritative unmodified artifact. Geometry type/coordinates and extra
    properties are retained verbatim from JSON, without repair or rounding.

    Frozen prevents field reassignment, not mutation of nested dicts/lists: these
    containers are owned by this result and consumers MUST treat them read-only.
    The codec intentionally does not duplicate large parsed geometry trees.
    """
    plan_id: str
    plan_name: str
    region_id: str
    layer_context: dict
    source_observed_at: str
    source_metadata: dict
    kbli: dict
    activity: dict
    filter_zone_codes: list
    features: list
    quarantine: list
    counts: dict
    content_fingerprint: str
    artifact_sha256: str
    raw_bytes: bytes = field(repr=False)
    geometry_scope: str = field(default='filtered_subset', init=False)
    rules_scope: str = field(default='filter_membership_only', init=False)


def _validate_archived(payload, quarantine, ctx):
    """Mirror the live contract without its wall-clock/freshness policy.

    Reuse its pinned catalog, strict JSON and geometry validity validator; add
    exact JSON type checks where Python equality would otherwise accept bool/int.
    No source field is changed to trick the live validator into accepting an age.
    """
    require = source.require
    require(ctx.activity_id is not None)
    require(payload['type'] == 'FeatureCollection')
    require('crs' not in payload or payload['crs']['properties']['name'] in
            ('EPSG:4326', 'urn:ogc:def:crs:OGC:1.3:CRS84'))
    meta = payload['meta']
    require(meta['plan'] == {'id': ctx.id, 'name': ctx.name, 'regionId': ctx.region_id})
    require(source.encoded(meta['activity']) == source.encoded({
        'id': ctx.activity_id, 'name': ctx.activity_name,
        'filterField': ctx.filter_field, 'mappingReviewed': False}))
    require(source.encoded(meta['kbli']) == source.encoded({
        'code': source.KBLI, 'version': '2025', 'scope': 'budidaya-kakao',
        'scopeConfirmed': False, 'mappingReviewed': False}))
    require(meta['coverage'] == 'loaded-plan-matching-zones-only')
    require(meta['geometryPurpose'] == 'display' and meta['limitations'] == source.LIMITATIONS)
    zones = meta['filterZoneCodes']
    require(isinstance(zones, list) and 0 < len(zones) <= 100)
    require(all(isinstance(z, str) and re.fullmatch(r'[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)*', z)
                for z in zones))
    require(len(zones) == len(set(zones)))
    metadata = meta['source']
    require(metadata['status'] in ('live', 'cached_snapshot'))
    for key, expected in (('activitiesUrl', ctx.activities_url), ('metadataUrl', ctx.metadata_url),
                          ('geometryQueryUrl', ctx.query_url), ('catalogUrl', ctx.catalog_url)):
        require(metadata[key] == expected)
    for key, expected in (('nativeWkid', ctx.native_wkid), ('outputWkid', 4326)):
        require(type(metadata[key]) is int and metadata[key] == expected)
    timestamp = metadata['retrievedAt']
    _token(timestamp, r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z',
           'invalid_source_timestamp')
    datetime.fromisoformat(timestamp.replace('Z', '+00:00'))  # Syntax only, no age check.
    require(isinstance(payload['features'], list) and isinstance(quarantine, list))
    seen = set()
    for feature in payload['features']:
        p = feature['properties']
        oid = p['object_id']
        require(type(oid) is int and oid >= 0 and oid not in seen)
        require(type(feature['id']) is int and feature['id'] == oid)
        require('OBJECTID' not in p or (type(p['OBJECTID']) is int and p['OBJECTID'] == oid))
        seen.add(oid)
        require(feature['type'] == 'Feature' and source.geometry_problem(feature['geometry']) is None)
        require(p['filter_value'] in zones and p['plan_id'] == ctx.id)
        require(p['activity_id'] == ctx.activity_id and p['activity_name'] == ctx.activity_name)
        require(isinstance(p['zone_code'], str) and bool(p['zone_code'].strip()))
        require(ctx.filter_field != 'KODSZN' or p['zone_code'] == p['filter_value'])
        require(p['permission'] == 'unknown' and p['evidence_status'] == 'unreviewed_mapping')
        require(all(isinstance(p[k], str) and p[k].strip()
                    for k in ('activity_name', 'zone_name', 'zone_group')))
        require(p['regulation'] is None or isinstance(p['regulation'], str))
    for q in quarantine:
        oid = q['object_id']
        require(type(oid) is int and oid >= 0 and oid not in seen)
        feature = q['feature']
        p = feature['properties']
        require(type(p['OBJECTID']) is int and p['OBJECTID'] == oid)
        require('id' not in feature or (type(feature['id']) is int and feature['id'] == oid))
        require(isinstance(q['reason'], str) and bool(q['reason'].strip()))
        require(p[ctx.filter_field] in zones and feature['type'] == 'Feature')
        require(isinstance(p['KODSZN'], str) and bool(p['KODSZN'].strip()))
        require(all(isinstance(p[k], str) and p[k].strip() for k in ('NAMSZN', 'NAMZON')))
        require(p.get('NOTHPR') is None or isinstance(p['NOTHPR'], str))
        require(source.geometry_problem(feature.get('geometry')) is not None)
        seen.add(oid)
    counts = meta['counts']
    require(all(type(counts[k]) is int for k in ('matched', 'returned', 'excludedInvalid')))
    require(counts == {'matched': len(seen), 'returned': len(payload['features']),
                       'excludedInvalid': len(quarantine)} and len(seen) <= source.MAX_IDS)


def _decode(raw):
    try:
        envelope = source.strict_json(raw.decode('utf-8'))
        source.require(isinstance(envelope, dict) and
                       set(envelope) == {'version', 'contextHash', 'data', 'sha256'})
        source.require(type(envelope['version']) is int and envelope['version'] == 2)
        _token(envelope['sha256'], r'[0-9a-f]{64}', 'invalid_data_sha256')
        _token(envelope['contextHash'], r'[0-9a-f]{64}', 'invalid_context_hash')
        data = envelope['data']
        source.require(isinstance(data, dict) and set(data) == {'payload', 'quarantine'})
        # allow_nan=False also rejects overflow floats (e.g. JSON 1e999).
        source.require(hashlib.sha256(source.encoded(data)).hexdigest() == envelope['sha256'],
                       'data_checksum_mismatch')
        payload = data['payload']
        meta = payload['meta']
        ctx = _plan(meta['plan']['id'])
        source.require(envelope['contextHash'] == hashlib.sha256(
            source.encoded(ctx._asdict())).hexdigest(), 'context_hash_mismatch')
        _validate_archived(payload, data['quarantine'], ctx)
        return envelope, data, payload, meta, ctx
    except (source.APIError, KeyError, TypeError, AttributeError, UnicodeError,
            RecursionError, OverflowError) as error:
        raise ValueError('invalid_snapshot') from error


# Exclusions are PATH-SCOPED, never recursive: source feature attributes or
# rule evidence named status/retrievedAt/jobId remain meaningful content.
_OBSERVATION_KEYS = frozenset(('retrievedAt', 'retrieved_at', 'checkedAt', 'checked_at',
                               'lastCheckedAt', 'jobId', 'job_id', 'importJobId'))
_TRANSPORT_KEYS = frozenset(('status', 'cacheReason', 'transfers'))


def _fingerprint(data, ctx):
    """Canonical semantic hash, without copying any feature/coordinate tree.

    Remove only observation timestamps/job IDs at payload.meta and
    payload.meta.source, plus source transport status/cacheReason/transfers.
    Everything else (including unknown metadata, rules, raw quarantine and
    feature properties with those same names) participates. JSON key order and
    whitespace do not participate; array order and exact numeric values do.
    """
    payload = data['payload']
    meta = {k: v for k, v in payload['meta'].items() if k not in _OBSERVATION_KEYS}
    meta['source'] = {k: v for k, v in meta['source'].items()
                      if k not in _OBSERVATION_KEYS | _TRANSPORT_KEYS}
    semantic = {'fingerprintVersion': 1, 'layerContext': ctx._asdict(),
                'data': dict(data, payload=dict(payload, meta=meta))}
    return hashlib.sha256(source.encoded(semantic)).hexdigest()


def read_snapshot(path, expected_sha256=None, expected_plan_id=None) -> NormalizedSnapshot:
    """Read an archived v2 snapshot; invalid inputs raise ValueError.

    Filesystem errors propagate as OSError. No network, TTL or freshness upgrade
    is performed. Every parsed value and hash comes from the same bounded read.
    """
    if expected_plan_id is not None:
        _token(expected_plan_id, r'[0-9]{10}:[0-9]{3}', 'invalid_expected_plan_id')
    if expected_sha256 is not None:
        _token(expected_sha256, r'[0-9a-f]{64}', 'invalid_expected_sha256')
    if expected_plan_id is not None:
        _plan(expected_plan_id)
    with Path(path).open('rb') as stream:
        raw = stream.read(MAX_SNAPSHOT_BYTES + 1)
    return read_snapshot_bytes(raw, expected_sha256, expected_plan_id)


def read_snapshot_bytes(raw, expected_sha256=None, expected_plan_id=None) -> NormalizedSnapshot:
    """Revalidate the captured artifact in memory; no filesystem reopen or network."""
    if expected_plan_id is not None:
        _token(expected_plan_id, r'[0-9]{10}:[0-9]{3}', 'invalid_expected_plan_id')
    if expected_sha256 is not None:
        _token(expected_sha256, r'[0-9a-f]{64}', 'invalid_expected_sha256')
    if expected_plan_id is not None:
        _plan(expected_plan_id)
    if type(raw) is not bytes:
        raise ValueError('invalid_snapshot_bytes')
    if len(raw) > MAX_SNAPSHOT_BYTES:
        raise ValueError('snapshot_size')
    artifact_sha256 = hashlib.sha256(raw).hexdigest()
    if expected_sha256 is not None and artifact_sha256 != expected_sha256:
        raise ValueError('artifact_sha256_mismatch')
    envelope, data, payload, meta, ctx = _decode(raw)
    if expected_plan_id is not None and ctx.id != expected_plan_id:
        raise ValueError('plan_id_mismatch')
    metadata = dict(meta['source'], status='local_dataset',
                    originalSourceStatus=meta['source']['status'])
    return NormalizedSnapshot(
        ctx.id, ctx.name, ctx.region_id, ctx._asdict(), meta['source']['retrievedAt'],
        metadata, meta['kbli'], meta['activity'], meta['filterZoneCodes'],
        payload['features'], data['quarantine'], meta['counts'],
        _fingerprint(data, ctx), artifact_sha256, raw)
