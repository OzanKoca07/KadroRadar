import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from source_pilot import budget, bound_report
from career_worker import collect
from official_rss import REGISTRY
import test_gazette_ephemeral as fixtures

class PilotTests(unittest.TestCase):
    def test_invalid_budgets_before_io(self):
        for limits in [{}, {'maxRecords': 0, 'maxDocuments': 1},
                       {'maxRecords': 26, 'maxDocuments': 1},
                       {'maxRecords': True, 'maxDocuments': 1},
                       {'maxRecords': 1, 'maxDocuments': 3}]:
            with self.assertRaises(ValueError):
                budget({'pilot': {'mode': 'staging-only', 'limits': limits}})

    def test_bound_across_multiple_documents(self):
        report = {'sourceId': 'gazette', 'documents': [
            {'parsed': {'candidates': [1, 2, 3]}}, {'parsed': {'candidates': [4]}}]}
        result = bound_report(report, {'maxRecords': 2, 'maxDocuments': 2})
        self.assertEqual([d['parsed']['candidates'] for d in result['documents']], [[1, 2], []])
        self.assertEqual(result['pilot']['parsedRecords'], 4)
        self.assertTrue(result['pilot']['truncated'])

    def test_career_fixture_selected_not_invented(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state, authorization, output = [root / n for n in ['state.json', 'authorization.json', 'report.json']]
            state.write_text(json.dumps({'pilot': {'mode': 'staging-only', 'limits': {'maxRecords': 1, 'maxDocuments': 1}}}))
            authorization.write_text(json.dumps(REGISTRY['career']))
            fixture = (Path(__file__).parent / 'fixtures/career-synthetic.xml').read_bytes()
            with patch('career_rss.require_network_permission'), patch('career_rss.check_robots'), patch('rss_transport.fetch_feed', return_value={'notModified': False, 'body': fixture, 'transport': {}}):
                collect(state, authorization, output)
            report = json.loads(output.read_text())
            self.assertEqual(len(report['rows']), 1)
            self.assertEqual(report['pilot']['parsedRecords'], 4)
            self.assertIsNone(report['rows'][0]['applicationEndAt'])
            self.assertEqual(report['missingGuids'], [])

    def test_gazette_actual_fetch_budget(self):
        fixture = fixtures.EphemeralTests()
        fixture.setUp()
        try:
            second = fixtures.PDF.replace('-4-1.pdf', '-4-2.pdf')
            fixture.index = fixture.index + ('<a href="' + second + '">SYNTHETIC</a>').encode()
            report = fixture.collect(previous={'pilot': {'mode': 'staging-only', 'limits': {'maxRecords': 1, 'maxDocuments': 1}}})
            self.assertEqual(report['metrics']['pdfDownloads'], 1)
            self.assertEqual(len(report['documents']), 1)
            self.assertEqual(sum(len(d['parsed']['candidates']) for d in report['documents']), 1)
            self.assertFalse(any(u == second for u, _ in fixture.calls))
        finally:
            fixture.doCleanups()
