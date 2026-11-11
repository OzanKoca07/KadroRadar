import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from career_worker import collect
from official_rss import REGISTRY


class CareerWorkerTests(unittest.TestCase):
    def test_closed_policy_before_network(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state, authorization, output = [root / name for name in ('state.json', 'authorization.json', 'report.json')]
            state.write_text('{}')
            authorization.write_text(json.dumps(REGISTRY['career']))
            with patch('rss_transport.fetch_feed', side_effect=AssertionError('NETWORK_FORBIDDEN')) as fetch:
                with self.assertRaises(ValueError):
                    collect(state, authorization, output)
                fetch.assert_not_called()
            self.assertFalse(output.exists())

    def test_identity_and_conditional_report(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state, authorization, output = [root / name for name in ('state.json', 'authorization.json', 'report.json')]
            state.write_text(json.dumps({'transport': {'documentSha256': 'a' * 64, 'etag': 'old', 'forceReparse': True}}))
            source = copy.deepcopy(REGISTRY['career'])
            source['feed'] = 'https://example.test/forbidden'
            authorization.write_text(json.dumps(source))
            with patch('career_worker.sync') as sync:
                with self.assertRaisesRegex(ValueError, 'SOURCE_IDENTITY_REJECTED'):
                    collect(state, authorization, output)
                sync.assert_not_called()
            authorization.write_text(json.dumps(REGISTRY['career']))
            with patch('career_worker.sync', return_value={'notModified': True, 'rows': []}):
                result = collect(state, authorization, output)
            self.assertTrue(result['notModified'])
            self.assertEqual(json.loads(output.read_text())['documentSha256'], 'a' * 64)
            self.assertIsNone(json.loads(state.read_text())['transport']['etag'])

    def test_synthetic_feed_through_adapter(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state, authorization, output = [root / name for name in ('state.json', 'authorization.json', 'report.json')]
            state.write_text('{}')
            authorization.write_text(json.dumps(REGISTRY['career']))
            fixture = (Path(__file__).parent / 'fixtures/career-synthetic.xml').read_bytes()
            with patch('career_rss.require_network_permission'), patch('career_rss.check_robots'), patch('rss_transport.fetch_feed', return_value={'notModified': False, 'body': fixture, 'transport': {}}):
                result = collect(state, authorization, output)
            report = json.loads(output.read_text())
            self.assertEqual(result['rows'], 4)
            self.assertEqual(report['sourceId'], 'career')
            self.assertEqual(len(report['documentSha256']), 64)
            self.assertNotIn('<rss', output.read_text())
            self.assertFalse(any(root.glob('*.xml')))
            self.assertIsNone(report['rows'][0]['applicationEndAt'])


if __name__ == '__main__':
    unittest.main()
