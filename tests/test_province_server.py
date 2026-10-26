"""Offline multi-plan fixtures; invented polygons are not RDTR evidence."""
import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from test_zone_server import load_server, fixture_feature

ROOT = Path(__file__).resolve().parents[1]


class CatalogTests(unittest.TestCase):
    def test_catalog_and_literal_registry_queries_over_http(self):
        s = load_server()
        registry = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())
        with tempfile.TemporaryDirectory() as directory:
            httpd = s.make_server(port=0)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            def get(path, headers=None):
                c = http.client.HTTPConnection('127.0.0.1', httpd.server_port, timeout=5)
                c.request('GET', path, headers=headers or {})
                r = c.getresponse()
                body = r.read()
                result = r.status, json.loads(body)
                c.close()
                return result
            try:
                status, body = get('/api/catalog?kbli=01273')
                self.assertEqual(status, 200)
                self.assertEqual(body, registry)
                self.assertEqual((len(body['plans']), len(body['regions'])), (18, 17))
                for plan in registry['plans']:
                    self.assertEqual(s.parse_zone_query('plan=' + plan['id'] + '&kbli=01273'),
                                     (plan['id'], '01273'))
                    if plan['activity'] is None:
                        self.assertEqual(get('/api/zones?plan=' + plan['id'] + '&kbli=01273'),
                                         (422, {'error': {'code': 'activity_mapping_unavailable'}}))
                for query in ['', 'kbli=1273', 'kbli=%30%31%32%37%33', 'kbli=01273&kbli=01273',
                              'kbli=01273&url=https://example.org']:
                    self.assertEqual(get('/api/catalog?' + query)[0], 400)
                for query in ['plan=7411000000%3A002&kbli=01273',
                              'plan=7411000000:003&kbli=01273',
                              'plan=7411000000:002&kbli=01273&plan=7411000000:001',
                              'plan=7411000000:002&kbli=01273&url=https://example.org']:
                    self.assertEqual(get('/api/zones?' + query)[0], 400)
                for path in ['/api/catalog?kbli=01273', '/api/zones?plan=7411000000:002&kbli=01273']:
                    self.assertEqual(get(path, {'Origin': 'https://evil.example'})[0], 403)
                    self.assertEqual(get(path, {'Host': 'evil.example'})[0], 403)
            finally:
                httpd.shutdown()
                thread.join(5)
                httpd.server_close()


class PlanFixture:
    """Every fixture is pinned to one actual registry context; geometry is synthetic."""
    def __init__(self, s, plan, total=201):
        self.plan = copy.deepcopy(plan)
        self.calls = []
        self.ids = list(range(1, total + 1))
        self.catalog = {'status': 200, 'data': [{
            'id_wilayah': plan['regionId'], 'id_rtr': plan['rtr'], 'rtr': plan['name'],
            'url_mapserver': plan['servicePath'], 'sublayer_mapserver': plan['sublayer'],
            'kolom_unik': plan['filterField']}]}
        self.activities = {'status': 200, 'data': [{
            'id_kegiatan': plan['activity']['id'], 'kegiatan': plan['activity']['name'],
            'nilai_kolom_unik': json.dumps({'data': ['P-3.01' if plan['filterField'] == 'KODUNK' else 'P-3']})}]}
        self.metadata = {'geometryType': 'esriGeometryPolygon',
                         'extent': {'spatialReference': {'wkid': plan['nativeWkid']}},
                         'fields': [{'name': n, 'type': 'esriFieldTypeOID' if n == 'OBJECTID'
                                     else 'esriFieldTypeString'} for n in
                                    dict.fromkeys(['OBJECTID', 'KODSZN', 'NAMSZN', 'NAMZON',
                                                   'NOTHPR', plan['filterField']])]}
        self.features = {i: fixture_feature(i) for i in self.ids}
        if plan['filterField'] == 'KODUNK':
            for feature in self.features.values():
                feature['properties']['KODUNK'] = 'P-3.01'
        layer = 'https://gistaru.atrbpn.go.id/arcgis/rest/services/' + plan['servicePath'] + '/0'
        self.metadata_url = s.PROXY + layer + '?f=pjson'
        self.query_url = s.PROXY + layer + '/query'

    def __call__(self, url, params=None):
        self.calls.append((url, params))
        if url == self.plan['catalogUrl']:
            data = self.catalog
        elif url == self.plan['activitiesUrl']:
            data = self.activities
        elif url == self.metadata_url:
            data = self.metadata
        elif url != self.query_url:
            raise AssertionError('cross-plan source URL: ' + url)
        elif params.get('returnIdsOnly') == 'true':
            data = {'objectIdFieldName': 'OBJECTID', 'objectIds': self.ids}
        elif params.get('returnCountOnly') == 'true':
            data = {'count': len(self.ids)}
        else:
            data = {'type': 'FeatureCollection', 'features': [self.features[int(i)]
                    for i in params['objectIds'].split(',')]}
        return copy.deepcopy(data)


class PlanPipelineTests(unittest.TestCase):
    def test_every_mapped_plan_exact_context_filter_and_projected_output(self):
        s = load_server()
        registry = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())
        for p in registry['plans']:
            if p['activity'] is None:
                continue
            with self.subTest(plan=p['id']):
                fixture = PlanFixture(s, p)
                result, quarantined = s.load_live(fixture, plan_id=p['id'])
                self.assertEqual(quarantined, [])
                meta = result['meta']
                self.assertEqual(meta['plan'], {k: p[k] for k in ('id', 'name', 'regionId')})
                self.assertEqual(meta['activity'], {'id': p['activity']['id'], 'name': p['activity']['name'],
                                                   'filterField': p['filterField'], 'mappingReviewed': False})
                self.assertEqual(meta['counts'], {'matched': 201, 'returned': 201, 'excludedInvalid': 0})
                zones = json.loads(fixture.activities['data'][0]['nilai_kolom_unik'])['data']
                self.assertEqual(meta['filterZoneCodes'], zones)
                self.assertEqual(meta['source']['activitiesUrl'], p['activitiesUrl'])
                self.assertEqual(meta['source']['catalogUrl'], p['catalogUrl'])
                self.assertEqual(meta['source']['nativeWkid'], p['nativeWkid'])
                self.assertEqual(meta['source']['outputWkid'], 4326)
                for feature in result['features']:
                    props = feature['properties']
                    self.assertEqual(feature['id'], props['object_id'])
                    self.assertIs(type(feature['id']), int)
                    self.assertEqual(props['plan_id'], p['id'])
                    self.assertEqual(props['activity_id'], p['activity']['id'])
                    self.assertEqual(props['activity_name'], p['activity']['name'])
                    self.assertEqual(props['filter_value'], zones[0])
                    self.assertEqual(props['zone_code'], 'P-3')
                    self.assertEqual((props['permission'], props['evidence_status']),
                                     ('unknown', 'unreviewed_mapping'))
                queries = [params for url, params in fixture.calls if url == fixture.query_url]
                self.assertTrue(all(q['where'] == p['filterField'] + " IN ('" + zones[0] + "')" for q in queries))
                batches = [q for q in queries if 'objectIds' in q]
                cap = p.get('geometryBatchSize', 200)
                self.assertEqual([len(q['objectIds'].split(',')) for q in batches],
                                 [min(cap, 201 - i) for i in range(0, 201, cap)])
                self.assertTrue(all(q['outSR'] == '4326' and p['filterField'] in q['outFields'] for q in batches))

    def test_limitations_do_not_mislabel_other_plans_as_activity_041(self):
        s = load_server()
        plans = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans']
        plan = next(p for p in plans if p['activity'] and p['activity']['id'] != '041')
        result, _ = s.load_live(PlanFixture(s, plan, 1), plan_id=plan['id'])
        self.assertFalse(any('Aktivitas 041' in text for text in result['meta']['limitations']))
        self.assertEqual(result['meta']['activity']['id'], plan['activity']['id'])

    def test_changed_plan_activity_filter_and_ids_fail_closed_before_cache(self):
        s = load_server()
        plans = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans']
        p = next(p for p in plans if p['filterField'] == 'KODUNK')
        mutations = {
            'wrong_catalog_region': lambda f: f.catalog['data'][0].update(id_wilayah='7411000000'),
            'wrong_catalog_plan': lambda f: f.catalog['data'][0].update(id_rtr='002'),
            'wrong_service': lambda f: f.catalog['data'][0].update(url_mapserver=plans[0]['servicePath']),
            'wrong_field': lambda f: f.catalog['data'][0].update(kolom_unik='KODSZN'),
            'wrong_layer': lambda f: f.catalog['data'][0].update(sublayer_mapserver='0'),
            'duplicate_plan': lambda f: f.catalog['data'].append(copy.deepcopy(f.catalog['data'][0])),
            'wrong_name_same_activity_id': lambda f: f.activities['data'][0].update(kegiatan='Perkebunan Tanaman Aromatik/Penyegar '),
            'wrong_activity_id': lambda f: f.activities['data'][0].update(id_kegiatan='041'),
            'wrong_filter_value': lambda f: f.features[1]['properties'].update(KODUNK='P-3'),
            'missing_filter_field': lambda f: f.metadata.update(fields=[a for a in f.metadata['fields'] if a['name'] != 'KODUNK']),
            'id_mismatch': lambda f: f.features[1].update(id=999),
        }
        for name, mutate in mutations.items():
            with self.subTest(case=name):
                fixture = PlanFixture(s, p, 1)
                mutate(fixture)
                with self.assertRaises(s.APIError):
                    s.load_live(fixture, plan_id=p['id'])
                if name in ('wrong_catalog_region', 'wrong_catalog_plan', 'wrong_service', 'wrong_field',
                            'wrong_layer', 'duplicate_plan', 'wrong_name_same_activity_id', 'wrong_activity_id'):
                    self.assertFalse(any(url == fixture.query_url for url, _ in fixture.calls))

    def test_projected_coordinates_are_not_relabelled_or_repaired(self):
        s = load_server()
        plans = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans']
        for p in [p for p in plans if p['nativeWkid'] != 4326]:
            fixture = PlanFixture(s, p, 1)
            geometry = {'type': 'Polygon', 'coordinates': [[[500000, 9500000], [500100, 9500000],
                [500100, 9500100], [500000, 9500100], [500000, 9500000]]]}
            fixture.features[1]['geometry'] = geometry
            result, quarantine = s.load_live(fixture, plan_id=p['id'])
            self.assertEqual(result['meta']['counts'], {'matched': 1, 'returned': 0, 'excludedInvalid': 1})
            self.assertEqual(quarantine[0]['feature']['geometry'], geometry)


class MultiServiceTests(unittest.TestCase):
    def test_same_plan_does_not_queue_behind_a_slow_acquisition(self):
        import time
        from concurrent.futures import ThreadPoolExecutor
        s = load_server()
        p = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans'][0]
        entered, release = threading.Event(), threading.Event()
        with tempfile.TemporaryDirectory() as directory, ThreadPoolExecutor(max_workers=1) as pool:
            fixture = PlanFixture(s, p, 1)
            def factory():
                entered.set()
                release.wait(3)
                return fixture
            service = s.ZoneService(Path(directory).resolve(), plan_id=p['id'], fetch_factory=factory)
            future = pool.submit(service.get_zones)
            self.assertTrue(entered.wait(2))
            started = time.monotonic()
            try:
                with self.assertRaises(s.APIError) as error:
                    service.get_zones()
                self.assertEqual((error.exception.status, error.exception.code), (503, 'plan_busy'))
                self.assertLess(time.monotonic() - started, 1)
            finally:
                release.set()
            self.assertEqual(future.result(5)['meta']['source']['status'], 'live')

    def test_at_most_three_acquisitions_and_no_schema_fallback(self):
        from concurrent.futures import ThreadPoolExecutor
        s = load_server()
        plans = [p for p in json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans'] if p['activity']][:4]
        release = threading.Event()
        entered = [threading.Event() for _ in range(3)]
        with tempfile.TemporaryDirectory() as directory, ThreadPoolExecutor(max_workers=3) as pool:
            services, futures = [], []
            for index, p in enumerate(plans):
                fixture = PlanFixture(s, p, 1)
                def factory(i=index, f=fixture):
                    if i < 3:
                        entered[i].set()
                        if not release.wait(10):
                            raise AssertionError('bounded acquisition did not release')
                    return f
                service = s.ZoneService(Path(directory).resolve(), plan_id=p['id'], fetch_factory=factory)
                services.append(service)
                if index < 3:
                    futures.append(pool.submit(service.get_zones))
            try:
                self.assertTrue(all(event.wait(5) for event in entered))
                with self.assertRaises(s.APIError) as error:
                    services[3].get_zones()
                self.assertEqual((error.exception.status, error.exception.code), (503, 'upstream_busy'))
            finally:
                release.set()
            for future in futures:
                self.assertEqual(future.result(5)['meta']['source']['status'], 'live')
            fixture = PlanFixture(s, plans[0], 1)
            fixture.catalog['data'][0]['url_mapserver'] = plans[1]['servicePath']
            service = s.ZoneService(Path(directory).resolve(), plan_id=plans[0]['id'], fetch_factory=lambda: fixture, ttl=0)
            with self.assertRaises(s.APIError) as error:
                service.get_zones()
            self.assertEqual(error.exception.code, 'source_context_changed')
            self.assertEqual(service.get_zones.__self__._read_cache()[0]['meta']['source']['status'], 'live')

    def test_production_http_routes_immutable_services_concurrently(self):
        from concurrent.futures import ThreadPoolExecutor
        s = load_server()
        plans = [p for p in json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans'] if p['activity']][:3]
        barrier = threading.Barrier(3)
        with tempfile.TemporaryDirectory() as directory:
            services = {}
            for p in plans:
                fixture = PlanFixture(s, p, 2)
                def factory(f=fixture):
                    barrier.wait(timeout=5)
                    return f
                services[p['id']] = s.ZoneService(Path(directory).resolve(), plan_id=p['id'], fetch_factory=factory)
            httpd = s.make_server(port=0, services=services)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            def get(p):
                c = http.client.HTTPConnection('127.0.0.1', httpd.server_port, timeout=10)
                c.request('GET', '/api/zones?plan=' + p['id'] + '&kbli=01273')
                r = c.getresponse()
                body = json.loads(r.read())
                c.close()
                self.assertEqual(r.status, 200, body)
                self.assertEqual(body['meta']['plan']['id'], p['id'])
                self.assertTrue(all(f['properties']['plan_id'] == p['id'] for f in body['features']))
                self.assertEqual(body['meta']['activity']['id'], p['activity']['id'])
                return body
            try:
                with ThreadPoolExecutor(max_workers=3) as pool:
                    results = list(pool.map(get, plans))
                self.assertEqual(len({r['meta']['plan']['id'] for r in results}), 3)
                with self.assertRaises((AttributeError, TypeError)):
                    s.context_for(plans[0]['id']).name = 'wrong'
                with self.assertRaises(TypeError):
                    s.PLANS[plans[0]['id']] = None
            finally:
                httpd.shutdown()
                thread.join(5)
                httpd.server_close()

    def test_per_plan_private_cache_and_overlapping_ids_remain_separate(self):
        s = load_server()
        plans = [p for p in json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans'] if p['activity']]
        with tempfile.TemporaryDirectory() as directory:
            services = []
            for p in (plans[0], next(p for p in plans if p['filterField'] == 'KODUNK')):
                fixture = PlanFixture(s, p, 2)
                service = s.ZoneService(Path(directory).resolve(), plan_id=p['id'], fetch_factory=lambda f=fixture: f)
                payload = service.get_zones()
                self.assertEqual(payload['meta']['plan']['id'], p['id'])
                self.assertEqual([f['id'] for f in payload['features']], [1, 2])
                self.assertEqual(service.cache_path.stat().st_mode & 0o777, 0o600)
                services.append(service)
            self.assertNotEqual(services[0].cache_path, services[1].cache_path)
            self.assertIsNot(services[0].lock, services[1].lock)
            for service in services:
                cached = service.get_zones()
                self.assertEqual(cached['meta']['source']['status'], 'cached_snapshot')
                self.assertEqual(cached['meta']['plan']['id'], service.context.id)
            # A valid hash from another plan is not a valid snapshot for this plan.
            services[1].cache_path.write_bytes(services[0].cache_path.read_bytes())
            self.assertIsNone(services[1]._read_cache())
            # Rehashing a forged context/filter/name/topology must not bypass schema checks.
            first = json.loads(services[0].cache_path.read_text())
            for field, value in [('filter_value', 'R-1'), ('activity_name', 'unrelated'),
                                 ('plan_id', services[1].context.id), ('permission', 'allowed')]:
                forged = copy.deepcopy(first)
                forged['data']['payload']['features'][0]['properties'][field] = value
                import hashlib
                forged['sha256'] = hashlib.sha256(s.encoded(forged['data'])).hexdigest()
                services[0].cache_path.write_bytes(s.encoded(forged))
                self.assertIsNone(services[0]._read_cache(), field)


class ProvinceTransportTests(unittest.TestCase):
    def test_total_byte_budget_is_bounded_and_supports_large_original_routa(self):
        import io
        from unittest.mock import Mock
        s = load_server()
        class Reply(io.BytesIO):
            status = 200
            headers = {'Content-Type': 'application/json'}
            def read1(self, size=-1):
                return self.read(size)
        opener = Mock()
        opener.open.side_effect = [Reply(b'{"fixture":true}'), Reply(b'{"fixture":true}')]
        transport = s.LiveTransport(opener=opener, max_total_bytes=25)
        self.assertEqual(transport(s.ACTIVITIES_URL), {'fixture': True})
        with self.assertRaises(s.APIError) as error:
            transport(s.ACTIVITIES_URL)
        self.assertEqual(error.exception.code, 'upstream_size')
        self.assertEqual(s.MAX_SNAPSHOT_BYTES, 128 * 1024 * 1024)
        default = s.LiveTransport()
        self.assertEqual(default.max_total_bytes, 128 * 1024 * 1024)
        self.assertEqual(default.max_bytes, 16 * 1024 * 1024)

    def test_fixed_per_plan_allowlist_tls_redirect_and_url_budget(self):
        import io
        import ssl
        from unittest.mock import Mock
        s = load_server()
        p = json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans'][0]
        class Reply(io.BytesIO):
            status = 200
            headers = {'Content-Type': 'application/json'}
            def read1(self, size):
                return self.read(size)
        opener = Mock()
        opener.open.return_value = Reply(b'{}')
        transport = s.LiveTransport(plan_id=p['id'], opener=opener)
        self.assertEqual(transport(p['activitiesUrl']), {})
        for url in [s.ACTIVITIES_URL, 'http://gistaru.atrbpn.go.id/', 'https://example.org/']:
            with self.assertRaises(s.APIError):
                transport(url)
        self.assertEqual(opener.open.call_count, 1)
        with self.assertRaises(s.APIError) as error:
            transport(p['activitiesUrl'], {'where': 'x' * 2000})
        self.assertEqual(error.exception.code, 'upstream_url_budget')
        reply = Reply(b'{}')
        reply.status = 302
        opener.open.return_value = reply
        with self.assertRaises(s.APIError) as error:
            transport(p['activitiesUrl'])
        self.assertEqual(error.exception.code, 'upstream_redirect')
        secure = s.LiveTransport(plan_id=p['id'])
        handler = next(h for h in secure.opener.handlers if hasattr(h, '_context'))
        self.assertTrue(handler._context.check_hostname)
        self.assertEqual(handler._context.verify_mode, ssl.CERT_REQUIRED)
        self.assertIsNone(s.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.org/'))

    def test_long_dot_filter_and_four_digit_ids_split_below_1900_bytes(self):
        from urllib.parse import urlencode
        s = load_server()
        p = next(p for p in json.loads((ROOT / 'tools/rdtr-plans.json').read_text())['plans'] if p['filterField'] == 'KODUNK')
        fixture = PlanFixture(s, p, 0)
        fixture.ids = list(range(1000, 1502))
        fixture.features = {i: fixture_feature(i) for i in fixture.ids}
        zones = ['P-3.%02d' % i for i in range(20)]
        fixture.activities['data'][0]['nilai_kolom_unik'] = json.dumps({'data': zones})
        for f in fixture.features.values():
            f['properties']['KODUNK'] = zones[0]
        result, quarantine = s.load_live(fixture, plan_id=p['id'])
        batches = [(url, q) for url, q in fixture.calls if q and 'objectIds' in q]
        self.assertEqual(result['meta']['counts']['matched'], 502)
        self.assertEqual(quarantine, [])
        self.assertLess(len(batches[0][1]['objectIds'].split(',')), 200)
        self.assertTrue(all(len(q['objectIds'].split(',')) <= 200 and
                            len((url + '?' + urlencode(q)).encode()) <= 1900 for url, q in batches))
        self.assertEqual(sorted(int(i) for _, q in batches for i in q['objectIds'].split(',')), fixture.ids)
