import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from audit_coverage import inventory, validate_page


class CoverageTests(unittest.TestCase):
    def test_old_models_and_later_pages_are_included(self):
        calls = []
        def page(url):
            calls.append(url)
            if len(calls) == 1:
                return [{'id': 'internlm/old-model', 'pipeline_tag': 'text-generation', 'createdAt': '2024-01-01'}], 'https://huggingface.co/api/models?author=internlm&cursor=page2'
            return [{'id': 'internlm/new-model', 'pipeline_tag': 'image-text-to-text'}, {'id': 'other/fake', 'pipeline_tag': 'text-generation'}, {'id': 'internlm/embed', 'pipeline_tag': 'feature-extraction'}], None
        result = inventory('internlm', page)
        self.assertEqual([x['repo'] for x in result['entries']], ['internlm/old-model', 'internlm/new-model'])
        self.assertTrue(result['complete'])
        self.assertEqual(result['pages'], 2)

    def test_pagination_limit_does_not_claim_complete(self):
        result = inventory('internlm', lambda url: ([], 'https://huggingface.co/api/models?author=internlm&cursor=more'), max_pages=1)
        self.assertFalse(result['complete'])

    def test_pagination_cannot_change_host_or_author(self):
        for url in ['https://example.com/api/models?author=internlm', 'https://huggingface.co/api/models?author=other']:
            with self.assertRaises(ValueError):
                validate_page(url, 'internlm')
