import tempfile
import unittest
from pathlib import Path
from source_adapters import ADAPTERS, review_many

class AdaptersTests(unittest.TestCase):
    def test_registry_has_five_disabled_adapters(self):
        self.assertEqual(set(ADAPTERS),{'gazette','sbb','career','iskur','energy'})

    def test_discovery_does_not_assign_aggregator_as_employer_or_publish(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'index.html'
            file.write_text('<a href="/notice">Personel alımı</a><a href="https://evil.test/notice">Memur alımı</a><script><a href="/bad">İşçi alımı</a></script>',encoding='utf8')
            for source in ['sbb','career','iskur']:
                from official_rss import REGISTRY
                result=ADAPTERS[source]().review(file,REGISTRY[source]['feed'])
                self.assertEqual(len(result['links']),1);self.assertIsNone(result['links'][0]['organization'])
                self.assertFalse(result['links'][0]['publishable']);self.assertFalse(result['liveFetch'])
                self.assertEqual(len(result['documentSha256']),64)

    def test_failure_isolation_and_wrong_domain(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'rss.xml';file.write_text('<rss><channel/></rss>')
            results=review_many([{'sourceId':'sbb','sourceUrl':'https://evil.test','file':file},
                {'sourceId':'energy','sourceUrl':'https://enerji.gov.tr/RSS/15?t=1','file':file}])
            self.assertEqual(results[0]['status'],'ERROR');self.assertEqual(results[1]['itemCount'],0)

if __name__=='__main__':unittest.main()
