import json
import socket
import ssl
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from source_probe import probe


class ProbeTests(unittest.TestCase):
    def run_probe(self, phase_error=None, status=200, body=b'index', length=None):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)/'source.html'
            output.write_bytes(b'previous-complete')
            connection = MagicMock()
            response = MagicMock(status=status)
            response.getheader.side_effect = lambda name: str(length if length is not None else len(body)) if name == 'Content-Length' else None
            response.read1.side_effect = [body, b'']
            with patch('source_probe.socket.getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',443))]) as dns, patch('source_probe.socket.create_connection', return_value=connection) as tcp, patch('source_probe.ssl.create_default_context') as tls, patch('source_probe.http.client.HTTPResponse', return_value=response):
                tls.return_value.wrap_socket.return_value = connection
                if phase_error:
                    {'DNS': dns, 'TCP': tcp, 'TLS': tls.return_value.wrap_socket, 'HTTP_HEADERS': response.begin, 'HTTP_BODY': response.read1}[phase_error].side_effect = TimeoutError()
                result = probe('https://www.resmigazete.gov.tr/', 'gazette', output)
                saved = output.read_bytes()
                if not phase_error: tls.return_value.wrap_socket.assert_called_once_with(connection, server_hostname='www.resmigazete.gov.tr')
                return result, saved

    def test_phase_timeouts_keep_previous_complete_file(self):
        for phase in ['DNS','TCP','TLS','HTTP_HEADERS','HTTP_BODY']:
            result, saved = self.run_probe(phase_error=phase)
            self.assertEqual(result['failedPhase'], phase)
            self.assertEqual(result['status'], 'TIMEOUT')
            self.assertEqual(saved, b'previous-complete')

    def test_http_statuses_never_save_or_follow_redirect(self):
        for code, expected in [(302,'REDIRECT'),(403,'FORBIDDEN'),(429,'RATE_LIMITED'),(304,'NOT_MODIFIED')]:
            result, saved = self.run_probe(status=code)
            self.assertEqual(result['status'], expected)
            self.assertFalse(result['downloaded'])
            self.assertEqual(saved, b'previous-complete')

    def test_incomplete_body_is_not_saved(self):
        result, saved = self.run_probe(length=100)
        self.assertFalse(result['downloaded'])
        self.assertEqual(saved, b'previous-complete')

    def test_complete_body_has_hash(self):
        result, saved = self.run_probe()
        self.assertEqual(result['status'], 'OK')
        self.assertEqual(len(result['sha256']), 64)
        self.assertEqual(saved, b'index')

    def test_private_dns_is_rejected_before_connect(self):
        with patch('source_probe.socket.getaddrinfo', return_value=[(2,1,6,'',('127.0.0.1',443))]), patch('source_probe.socket.create_connection') as tcp:
            self.assertEqual(probe('https://www.resmigazete.gov.tr/', 'gazette', Path('unused'))['failedPhase'], 'DNS')
            tcp.assert_not_called()

    def test_wrong_source_url_rejected(self):
        with self.assertRaises(ValueError): probe('https://example.com/', 'gazette', Path('unused'))


if __name__ == '__main__': unittest.main()
