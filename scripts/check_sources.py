"""Inspect public upstream metadata; produce review proposals, never overwrite verified facts."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 3 * 1024 * 1024


def load(path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


class DocumentText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.hidden, self.main = [], 0, 0
        self.main_parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "header", "footer"):
            self.hidden += 1
        if tag in ("main", "article"):
            self.main += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "header", "footer"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("main", "article"):
            self.main = max(0, self.main - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)
            if self.main:
                self.main_parts.append(data)


def document_fingerprint(text):
    p = DocumentText()
    p.feed(text)
    normalized = " ".join(" ".join(p.main_parts or p.parts).split())
    # Build timestamps are not evidence changes. Dates inside actual model content remain.
    normalized = re.sub(r"Last updated on\s+[^.]{0,60}\bUTC\b", "", normalized, flags=re.I)
    return hashlib.sha256(normalized.encode()).hexdigest()


def config_facts(config):
    """Only extract explicit keys. Missing shared experts do not become zero."""
    text = config.get("text_config", config.get("llm_config", config))
    prefix = "text_config." if "text_config" in config else "llm_config." if "llm_config" in config else ""
    fields = {}
    aliases = {
        "routed": ("n_routed_experts", "num_experts", "num_local_experts", "moe_num_experts"),
        "selected": ("num_experts_per_tok", "moe_top_k"),
        "shared": ("n_shared_experts", "num_shared_experts"),
        "layers": ("num_hidden_layers", "num_layers"),
        "context": ("max_position_embeddings", "model_max_length"),
        "mtp_layers": ("num_nextn_predict_layers", "mtp_num_hidden_layers", "num_mtp_layers", "mtp_num_layers"),
        "dtype": ("dtype", "torch_dtype"),
    }
    for field, keys in aliases.items():
        for key in keys:
            if key in text and text[key] is not None:
                fields[field] = {"value": text[key], "locator": prefix + key}
                break
    if "architectures" in config:
        fields["architectures"] = {"value": config["architectures"], "locator": "architectures"}
    q = config.get("quantization_config", text.get("quantization_config"))
    if q:
        fields["quantization"] = {"value": {k: q[k] for k in ("quant_method", "fmt", "activation_scheme", "weight_block_size") if k in q}, "locator": "quantization_config"}
    # Total/active parameters are intentionally NOT calculated from names, file sizes, or expert ratios.
    return fields


class OfficialClient:
    def __init__(self, hosts):
        self.hosts = set(hosts)

    def get(self, url, as_json=False):
        if urllib.parse.urlsplit(url).scheme != "https" or urllib.parse.urlsplit(url).hostname not in self.hosts:
            raise ValueError("URL outside configured official HTTPS sources")
        request = urllib.request.Request(url, headers={"User-Agent": "ModelAtlasSourceMonitor/0.1 (+source-review-only)", "Accept": "application/json" if as_json else "text/html,text/plain;q=0.9"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=35) as response:
                    if urllib.parse.urlsplit(response.url).scheme != "https" or urllib.parse.urlsplit(response.url).hostname not in self.hosts:
                        raise ValueError("Unexpected upstream redirect")
                    raw = response.read(LIMIT + 1)
                    if len(raw) > LIMIT:
                        raise ValueError("Metadata response exceeds size limit; no weights are downloaded")
                    text = raw.decode("utf-8")
                    return json.loads(text) if as_json else text
            except urllib.error.HTTPError as exc:
                if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise
            except (TimeoutError, urllib.error.URLError):
                if attempt == 2:
                    raise
            time.sleep(2 ** attempt)


def inspect_repo(client, repo, baseline):
    meta = client.get("https://huggingface.co/api/models/" + repo, True)
    sha = meta["sha"]
    state = {"sha": sha}
    config_url = f"https://huggingface.co/{repo}/raw/{sha}/config.json"
    try:
        state["config"] = config_facts(client.get(config_url, True))
    except urllib.error.HTTPError as exc:
        if exc.code not in (401, 403, 404):
            raise
        state["config_access"] = f"HTTP {exc.code}; configuration not inspected"
    change = None
    if baseline and state != baseline:
        changes = {}
        for key in sorted(set(baseline.get("config", {})) | set(state.get("config", {}))) if 'config' in state and 'config' in baseline else []:
            before, after = baseline.get("config", {}).get(key), state.get("config", {}).get(key)
            if before != after:
                changes[key] = {"before": before, "after": after}
        change = {"kind": "repository_changed", "repo": repo, "oldRevision": baseline.get("sha"), "newRevision": sha, "url": "https://huggingface.co/" + repo, "configSource": config_url, "configChanges": changes, "configAccess": state.get('config_access','read'), "note": "New commit, configuration change or access change; inaccessible configurations are not treated as deleted fields. Author parameter claims, component scope and serving support still need review."}
    return repo, state, change


def inspect_document(client, url, baseline):
    text = client.get(url)
    state = {"sha256": document_fingerprint(text)}
    if url.endswith('/llms.txt'):
        state['recipePages'] = sorted(set(x.removesuffix('.md').rstrip('/') for x in re.findall(r'https://docs\.sglang\.io/cookbook/autoregressive/[A-Za-z0-9_./-]+', text) if not x.rstrip('/').endswith('/intro')))
    change = {"kind": "official_document_changed", "url": url, "before": baseline.get("sha256"), "after": state["sha256"], "note": "Official document content changed. Re-read the original page; no support claim has been changed."} if baseline and state != baseline else None
    if change and 'recipePages' in state:
        change['newRecipePages'] = sorted(set(state['recipePages']) - set(baseline.get('recipePages', [])))
    return url, state, change


def new_models(rows, known, since):
    result = []
    for row in rows:
        repo = row.get("id", row.get("modelId", ""))
        created = row.get("createdAt", "")
        if repo and repo.lower() not in known and created and created >= since:
            result.append({"kind": "new_model_candidate", "repo": repo, "createdAt": created, "url": "https://huggingface.co/" + repo, "note": "Listed under a monitored author account; not yet verified as an independent model, quantization or draft module."})
    return result


def markdown(report):
    lines = ["# 官方来源更新检查", "", f"检查时间：{report['checkedAt']}", "", f"{len(report['changes'])} 项变化；{len(report['errors'])} 项读取异常；{len(report['baselined'])} 项首次建立对照。", "", "本报告只提出待审核变化，不改写已核验参数、来源日期或框架支持。首次建立对照不代表完成事实核验。", ""]
    for item in report["changes"]:
        label = item.get("repo", item["url"])
        lines += [f"## {item['kind']} · {label}", "", f"来源：<{item['url']}>", "", item["note"], ""]
        if "configChanges" in item:
            lines += ["```json", json.dumps(item["configChanges"], ensure_ascii=False, indent=2), "```", "", f"固定配置：<{item['configSource']}>", ""]
        for url in item.get('newRecipePages', []):
            lines += [f'- 新部署文档：<{url}>']
    if report["errors"]:
        lines += ["## 读取异常", "", "读取失败不等于模型不存在、未披露或不支持。", ""]
        for error in report["errors"]:
            lines += [f"- `{error['target']}`：{error['error']}"]
    lines += ["", "审核后按 CONTRIBUTING.md 更新 data/，重新构建并提交；不要把一次检查成功当作所有参数重新核验。", ""]
    return "\n".join(lines)


def run(client, catalog, policy, baseline, now, discover=True, workers=4, coverage_output=None):
    current = {"schemaVersion": 1, "observedAt": now, "repos": {}, "documents": {}}
    report = {"schemaVersion": 1, "checkedAt": now, "changes": [], "errors": [], "baselined": [], "successfulTargets": 0}
    repos = sorted(set(m["repo"] for m in catalog["models"] if m["access"] == "weights"))
    urls = set(policy["documents"])
    if policy.get("watchFrameworkRecipePages", True):
        urls.update(e["url"] for x in catalog["frameworkIndex"]["entries"] for e in x["evidence"] if e["framework"] == "SGLang")
    tasks = [("repo", x) for x in repos] + [("document", x) for x in sorted(urls)]
    def inspect(task):
        kind, target = task
        old = baseline.get("repos" if kind == "repo" else "documents", {}).get(target)
        try:
            _, state, change = inspect_repo(client, target, old) if kind == "repo" else inspect_document(client, target, old)
            return kind, target, state, change, old is None, None
        except Exception as exc:
            # Do not serialize response bodies or headers, which may contain unrelated details.
            error = f"HTTP {exc.code}" if isinstance(exc, urllib.error.HTTPError) else type(exc).__name__ + ": upstream metadata unavailable"
            return kind, target, old, None, False, error
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for kind, target, state, change, first, error in pool.map(inspect, tasks):
            if state:
                current["repos" if kind == "repo" else "documents"][target] = state
            if change:
                report["changes"].append(change)
            if first:
                report["baselined"].append(target)
            if error:
                report["errors"].append({"target": target, "error": error})
            else:
                report['successfulTargets'] += 1
    if discover:
        known = {m["repo"].lower() for m in catalog["models"]} | {x["repo"].lower() for x in catalog["frameworkIndex"]["entries"] if x.get("repo")}
        since = baseline.get("observedAt", policy["discoverySince"])
        def discover_author(author):
            url = "https://huggingface.co/api/models?" + urllib.parse.urlencode({"author": author, "sort": "createdAt", "direction": -1, "limit": policy.get("discoveryLimitPerAuthor", 20), "full": "true"})
            try:
                return new_models(client.get(url, True), known, since), None
            except Exception as exc:
                return [], {"target": "author:" + author, "error": f"HTTP {exc.code}" if isinstance(exc, urllib.error.HTTPError) else type(exc).__name__}
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            for candidates, error in pool.map(discover_author, policy['authors']):
                report['changes'].extend(candidates)
                if error:
                    report['errors'].append(error)
        # A separate full inventory catches historical omissions: creation-date discovery cannot.
        from audit_coverage import audit
        previous = load(ROOT / 'data/coverage-audit.json', {})
        coverage = audit(policy, previous, workers)
        if coverage_output:
            save(coverage_output, coverage)
        reviewed = {m['repo'].lower() for m in catalog['models']}
        seen = {x['repo'].lower() for inv in previous.get('inventories', []) for x in inv['entries']}
        for inv in coverage['inventories']:
            for item in inv['entries']:
                if item['repo'].lower() not in reviewed | seen:
                    report['changes'].append({'kind': 'coverage_gap_candidate', 'repo': item['repo'], 'url': item['url'], 'note': 'Full paginated author inventory found an unreviewed repository, regardless of its creation date. A candidate is not a verified independent model or parameter claim.'})
        report['errors'].extend({'target': 'coverage:' + x['target'], 'error': x['error']} for x in coverage['errors'])
    report["changes"].sort(key=lambda x: (x["kind"], x.get("repo", x["url"])))
    report["fingerprint"] = digest({"changes": report["changes"], "errors": sorted(report["errors"], key=lambda x: x["target"])})
    return report, current


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "updates")
    parser.add_argument("--baseline", type=Path, default=ROOT / "data/watch-state.json")
    parser.add_argument("--bootstrap", action="store_true", help="Explicitly establish the monitoring baseline; never changes fact verification dates")
    parser.add_argument("--no-discovery", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    catalog, policy = load(ROOT / "dist/data.json"), load(ROOT / "data/upstreams.json")
    baseline = load(args.baseline, {})
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    report, current = run(OfficialClient(policy["hosts"]), catalog, policy, baseline, now, not args.no_discovery, max(1, min(args.workers, 8)), args.output / 'coverage-audit.json')
    save(args.output / "pending.json", report)
    save(args.output / "observed-state.json", current)
    (args.output / "report.md").write_text(markdown(report), encoding="utf-8")
    if args.bootstrap:
        save(args.baseline, current)
    print(json.dumps({"changes": len(report["changes"]), "errors": len(report["errors"]), "baselined": len(report["baselined"]), "verifiedFactsModified": False}))
    # A totally failed inspection must fail visibly instead of reporting a clean catalog.
    if report['successfulTargets'] == 0:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
