"""Rollback-only batch contract and fresh all-member proof tests."""
from unittest.mock import patch
from test_rdtr_read_batch import combined, OTHER
from test_rdtr_local_api import SQLFixture, PLAN, legacy


class DisplayBatchTests(SQLFixture):
    def test_batch_proves_all_once_preserving_order_and_individual_bytes(self):
        pin, first, second = combined(self.conn)
        api = self.api()
        individual = {p:legacy.encoded(api.get_display(self.conn,p,'overview',pin)) for p in (PLAN,OTHER)}
        self.assertTrue(hasattr(api,'get_display_batch'), 'overview batch API missing')
        with patch.object(api,'_release',wraps=api._release) as proof, patch.object(api,'_rows',wraps=api._rows) as reads:
            value = api.get_display_batch(self.conn,[OTHER,PLAN],'overview',pin)
        self.assertEqual(proof.call_count,1)
        self.assertEqual(reads.call_count,6)
        self.assertEqual(set(value),{'schemaVersion','releaseHash','results'})
        self.assertEqual((value['schemaVersion'],value['releaseHash']),(1,pin))
        self.assertEqual(api.get_catalog_for_release(self.conn,pin)['localCapabilities'],{'displayBatchOverview':True})
        self.assertEqual([x['planId'] for x in value['results']],[OTHER,PLAN])
        for item in value['results']:
            self.assertEqual(set(item),{'planId','data'})
            self.assertEqual(legacy.encoded(item['data']),individual[item['planId']])

    def test_batch_route_strict_literal_query_and_global_failure(self):
        from test_rdtr_local_http import LocalHTTPTests
        pin, first, second = combined(self.conn)
        self.start = LocalHTTPTests.start.__get__(self)
        self.request = LocalHTTPTests.request.__get__(self)
        server = self.start()
        path = '/api/display-batch?kbli=01273&level=overview&release='+pin+'&plans='+OTHER+','+PLAN
        status, headers, body = self.request(path)
        self.assertEqual(status,200)
        import json
        self.assertEqual(json.loads(body)['releaseHash'],pin)
        self.assertEqual(headers['Cache-Control'],'no-store')
        for bad in [path+'&bbox=120,-5,121,-4',path+'&plans='+PLAN,path.replace('overview','detail'),path.replace(OTHER+','+PLAN,PLAN+','+PLAN),path.replace(OTHER,OTHER.replace(':','%3A')),path.replace(pin,pin.upper()),path+'&unknown=1',path.replace('01273','1273'),path.replace(OTHER+','+PLAN,''),path.replace(OTHER,'9999999999:001')]:
            with self.subTest(bad=bad):self.assertEqual(self.request(bad)[0],400)
        self.assertEqual(self.request(path.replace(OTHER,'7401000000:001'))[0],422)
        with patch.object(server.api,'get_display_batch',side_effect=legacy.APIError('dataset_unavailable',503)):
            self.assertEqual(self.request(path)[0],503)

    def test_fresh_non_target_tamper_partial_projection_and_old_pin(self):
        pin, first, second = combined(self.conn)
        api = self.api()
        api.get_display_batch(self.conn,[PLAN],'overview',pin)
        for table, sql in [('zone_display',"UPDATE rdtr.zone_display SET qc_result='{}' WHERE plan_version_id=%s"),('zone_feature','UPDATE rdtr.zone_feature SET geom_original_4326=ST_Reverse(geom_original_4326) WHERE plan_version_id=%s'),('plan_version',"UPDATE rdtr.plan_version SET source_time=source_time+interval '1 day' WHERE id=%s")]:
            with self.subTest(sql=sql),self.conn.transaction(force_rollback=True):
                self.conn.execute('ALTER TABLE rdtr.'+table+' DISABLE TRIGGER USER')
                self.conn.execute(sql,(second['version'],))
                with self.assertRaises(legacy.APIError) as caught:api.get_display_batch(self.conn,[PLAN],'overview',pin)
                self.assertEqual(caught.exception.status,503)
        with self.conn.transaction(force_rollback=True):
            self.conn.execute('ALTER TABLE rdtr.zone_feature DISABLE TRIGGER USER')
            self.conn.execute("UPDATE rdtr.zone_feature SET source_properties=jsonb_set(source_properties,'{activity_id}','-1') WHERE plan_version_id=%s",(second['version'],))
            result=api.get_display_batch(self.conn,[OTHER,PLAN],'overview',pin)
            self.assertEqual(result['results'][0],{'planId':OTHER,'error':{'code':'dataset_unavailable','status':503}})
            self.assertIn('data',result['results'][1])
        old=api.get_display_batch(self.conn,[PLAN],'overview',first['release_hash'])
        self.assertEqual(legacy.encoded(old['results'][0]['data']),legacy.encoded(api.get_display(self.conn,PLAN,'overview',first['release_hash'])))
        for plans,level,token,status in [([PLAN,PLAN],'overview',pin,400),([],'overview',pin,400),([PLAN]*17,'overview',pin,400),([PLAN],'detail',pin,400),([PLAN],'overview',pin.upper(),400),([OTHER],'overview',first['release_hash'],422)]:
            with self.assertRaises(legacy.APIError) as caught:api.get_display_batch(self.conn,plans,level,token)
            self.assertEqual(caught.exception.status,status)
