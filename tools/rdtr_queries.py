"""Bounded local SQL reads. No HTTP, catalog fetch, geometry repair or activation."""
import math
import re


def database_status(conn):
    row=conn.execute('''SELECT (SELECT count(*) FROM rdtr.rdtr_plan),
        (SELECT count(*) FROM rdtr.plan_version),
        (SELECT count(*) FROM rdtr.zone_feature),
        (SELECT count(*) FROM rdtr.active_release)''').fetchone()
    versions=conn.execute('''SELECT p.source_plan_id,p.name,v.id,v.valid_feature_count,
        v.quarantined_feature_count,v.geometry_scope,v.rules_scope,v.source_time,
        v.ingest_state,v.published_at FROM rdtr.plan_version v JOIN rdtr.rdtr_plan p
        ON p.id=v.plan_id ORDER BY p.source_plan_id,v.created_at,v.id''').fetchall()
    return {'source_kind':'local_dataset','plan_count':row[0],'version_count':row[1],
        'stored_feature_rows':row[2],'active_release_count':row[3],
        'versions':[{'plan_id':r[0],'plan_name':r[1],'version_id':str(r[2]),
        'valid_features':r[3],'quarantined_features':r[4],'geometry_scope':r[5],
        'rules_scope':r[6],'source_observed_at':r[7].isoformat() if r[7] else None,
        'ingest_state':r[8],'published':r[9] is not None} for r in versions]}


def query_bbox(conn,version_id,bbox,*,limit=100):
    """Return source IDs/labels only; exact original-polygon intersection."""
    if (not isinstance(version_id,str) or not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',version_id)
        or type(limit) is not int or not 1<=limit<=500
        or not isinstance(bbox,(tuple,list)) or len(bbox)!=4
        or any(type(v) not in (int,float) or not math.isfinite(v) for v in bbox)):
        raise ValueError('invalid_query_parameters')
    west,south,east,north=bbox
    if not (-180<=west<east<=180 and -90<=south<north<=90):
        raise ValueError('invalid_query_parameters')
    version=conn.execute('''SELECT geometry_scope,rules_scope,source_time
        FROM rdtr.plan_version WHERE id=%s''',(version_id,)).fetchone()
    if version is None:
        raise ValueError('unknown_plan_version')
    where='''FROM rdtr.zone_feature WHERE plan_version_id=%s AND
        public.ST_Intersects(geom_original_4326,public.ST_MakeEnvelope(%s,%s,%s,%s,4326))'''
    args=(version_id,*bbox)
    count=conn.execute('SELECT count(*) '+where,args).fetchone()[0]
    rows=conn.execute('SELECT id,source_object_id,zone_code,zone_name '+where+
        ' ORDER BY source_object_id LIMIT %s',(*args,limit+1)).fetchall()
    return {'version_id':version_id,'source_kind':'local_dataset',
        'geometry_scope':version[0],'rules_scope':version[1],
        'source_observed_at':version[2].isoformat() if version[2] else None,
        'permission_assessment_performed':False,'matching_feature_count':count,
        'returned_count':min(len(rows),limit),'has_more':len(rows)>limit,
        'items':[{'feature_id':str(r[0]),'source_object_id':r[1],
            'zone_code':r[2],'zone_name':r[3]} for r in rows[:limit]]}
