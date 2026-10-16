"""Compare all available author inventory pages and framework references with curated records.

Inventory membership is discovery evidence, never a parameter or serving-support claim.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from check_sources import ROOT, load, save

PIPELINES = {'text-generation', 'image-text-to-text', 'any-to-any'}


def validate_page(url, author):
    parts = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qs(parts.query)
    if parts.scheme != 'https' or parts.netloc != 'huggingface.co' or parts.path != '/api/models' or query.get('author') != [author]:
        raise ValueError('Unexpected inventory pagination URL')
    return url


def fetch_page(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'ModelAtlasCoverageAudit/0.2'})
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read(4 * 1024 * 1024 + 1)
        if len(raw) > 4 * 1024 * 1024:
            raise ValueError('Inventory page exceeds metadata limit')
        links = response.headers.get('Link', '')
        match = re.search(r'<([^>]+)>;\s*rel="next"', links)
        return json.loads(raw), match.group(1) if match else None


def inventory(author, fetch=fetch_page, max_pages=50):
    url = 'https://huggingface.co/api/models?' + urllib.parse.urlencode({'author': author, 'limit': 100, 'sort': 'createdAt', 'direction': -1})
    rows, seen = {}, set()
    for page in range(max_pages):
        validate_page(url, author)
        if url in seen:
            raise ValueError('Repeated inventory cursor')
        seen.add(url)
        batch, next_url = fetch(url)
        for item in batch:
            repo = item.get('id', item.get('modelId', ''))
            if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo) or repo.split('/')[0].lower() != author.lower():
                continue
            pipeline = item.get('pipeline_tag', '')
            tags = item.get('tags', [])
            if pipeline not in PIPELINES and not any(t in PIPELINES for t in tags):
                continue
            rows[repo.lower()] = {'repo': repo, 'publisher': author, 'url': 'https://huggingface.co/' + repo, 'pipeline': pipeline, 'revision': item.get('sha'), 'createdAt': item.get('createdAt')}
        if not next_url:
            return {'publisher': author, 'pages': page + 1, 'complete': True, 'entries': list(rows.values())}
        url = validate_page(next_url, author)
    return {'publisher': author, 'pages': max_pages, 'complete': False, 'entries': list(rows.values())}


def audit(policy, previous=None, workers=4):
    previous = previous or {}
    old = {x['publisher']: x for x in previous.get('inventories', [])}
    results, errors = [], []
    def inspect(author):
        try:
            return inventory(author), None
        except Exception as exc:
            # Preserve the previous inventory, but mark it stale instead of silently dropping gaps.
            fallback = dict(old.get(author, {'publisher': author, 'entries': [], 'pages': 0}))
            fallback.update(complete=False, stale=True)
            return fallback, {'target': author, 'error': type(exc).__name__}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for result, error in pool.map(inspect, policy['authors']):
            results.append(result)
            if error:
                errors.append(error)
    return {'schemaVersion': 1, 'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'), 'scope': 'Configured author namespaces; paginated public repositories tagged text-generation, image-text-to-text or any-to-any. No creation-date cutoff. Framework references are joined separately at build time. Other publishers, API-only releases and untagged repositories require separate discovery.', 'inventories': sorted(results, key=lambda x: x['publisher'].lower()), 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'updates/coverage-audit.json')
    args = parser.parse_args()
    result = audit(load(ROOT / 'data/upstreams.json'), load(ROOT / 'data/coverage-audit.json', {}))
    save(args.output, result)
    print(json.dumps({'authors': len(result['inventories']), 'repositories': sum(len(x['entries']) for x in result['inventories']), 'incompleteAuthors': [x['publisher'] for x in result['inventories'] if not x['complete']], 'errors': result['errors']}))
    return 0 if any(x['complete'] for x in result['inventories']) else 2


if __name__ == '__main__':
    raise SystemExit(main())
