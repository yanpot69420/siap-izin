"""Synthetic assertions for curated metadata, not geometry or permission evidence."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ProvinceRegistryTests(unittest.TestCase):
    def test_lasalimu_uses_beverage_crop_relation_not_spice_or_aromatic_branch(self):
        data = json.loads((ROOT / 'tools' / 'rdtr-plans.json').read_text())
        plan = next(p for p in data['plans'] if p['id'] == '7404000000:001')
        self.assertEqual(plan['activity']['id'], '014')
        self.assertEqual(plan['activity']['name'], 'Pertanian Tanaman Untuk Bahan Minuman')
        self.assertFalse(plan['activity']['mappingReviewed'])

    def test_all_discovered_plans_and_all_administrative_regions_are_explicit(self):
        path = ROOT / 'tools' / 'rdtr-plans.json'
        self.assertTrue(path.exists(), 'Provincial source registry missing')
        data = json.loads(path.read_text())
        self.assertEqual(data['schemaVersion'], 1)
        self.assertEqual(data['kbli'], '01273')
        self.assertEqual(len(data['regions']), 17)
        self.assertEqual(len({r['id'] for r in data['regions']}), 17)
        self.assertEqual(len(data['plans']), 18)
        self.assertEqual(len({p['id'] for p in data['plans']}), 18)
        regions = {r['id'] for r in data['regions']}
        for p in data['plans']:
            self.assertIn(p['regionId'], regions)
            self.assertEqual(p['id'], p['regionId'] + ':' + p['rtr'])
            self.assertIn(p['filterField'], ('KODSZN', 'KODUNK'))
            self.assertIn(p['nativeWkid'], (4326, 32749, 32751))
            if p['activity']:
                self.assertEqual(p['activity']['mappingReviewed'], False)
                self.assertRegex(p['activity']['id'], r'^\d{3,4}$')
                self.assertNotIn('industri', p['activity']['name'].lower())
                self.assertNotIn('perdagangan', p['activity']['name'].lower())
        langara = next(p for p in data['plans'] if p['id'] == '7412000000:001')
        self.assertEqual(langara['filterField'], 'KODUNK')
        self.assertEqual(langara['activity']['id'], '320')
        self.assertEqual(next(p for p in data['plans'] if p['id'] == '7402000000:003')['nativeWkid'], 32749)
        self.assertEqual(next(p for p in data['plans'] if p['id'] == '7405000000:001')['nativeWkid'], 32751)
        for pid in ('7409000000:001', '7471000000:001'):
            self.assertIsNone(next(p for p in data['plans'] if p['id'] == pid)['activity'])
        for region in data['regions']:
            self.assertEqual(set(region['planIds']), {p['id'] for p in data['plans'] if p['regionId'] == region['id']})
            self.assertIn(region['catalogStatus'], ('listed', 'not_listed_in_public_catalog'))

if __name__ == '__main__':
    unittest.main()
