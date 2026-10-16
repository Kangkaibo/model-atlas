"""Publish an explicitly requested review PR from a trusted scheduled workflow."""
import datetime as dt
import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, check=True, text=True, capture_output=True).stdout.strip()


def main():
    report = json.loads((ROOT/'updates/pending.json').read_text(encoding='utf-8'))
    if not report['changes'] and not report['errors'] and not report['baselined']:
        print('No upstream changes or read failures; no PR created.')
        return
    repo, token = os.environ['GITHUB_REPOSITORY'], os.environ['GH_TOKEN']
    if not __import__('re').fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise ValueError('Invalid repository identity')
    if os.environ.get('GITHUB_EVENT_NAME') not in ('schedule','workflow_dispatch'):
        raise ValueError('Update publication is restricted to trusted scheduled/manual runs')
    def api(path, data=None):
        body=json.dumps(data).encode() if data is not None else None
        req=urllib.request.Request('https://api.github.com/repos/'+repo+path,data=body,headers={'Authorization':'Bearer '+token,'User-Agent':'ModelAtlasUpdater','Accept':'application/vnd.github+json','Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=40) as response:
            return json.load(response)
    marker='<!-- model-atlas-audit:'+report['fingerprint']+' -->'
    # Idempotency: a repeated check with the same findings must not create another PR.
    for pr in api('/pulls?state=open&per_page=100'):
        if marker in (pr.get('body') or ''):
            print('Identical findings already have an open review PR: '+pr['html_url'])
            return
    for issue in api('/issues?state=open&per_page=100'):
        if marker in (issue.get('body') or ''):
            print('Identical findings already have an open review issue: '+issue['html_url'])
            return
    default=api('')['default_branch']
    branch='codex/source-audit-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d-%H%M%S')
    git('switch','-c',branch)
    shutil.copyfile(ROOT/'updates/observed-state.json',ROOT/'data/watch-state.json')
    git('config','user.name','github-actions[bot]')
    git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
    git('add','--','data/watch-state.json','updates/pending.json','updates/report.md')
    if (ROOT/'updates/coverage-audit.json').exists():
        git('add','--','updates/coverage-audit.json')
    git('commit','-m','chore: propose official source review')
    git('push','origin','HEAD:refs/heads/'+branch)
    body=(ROOT/'updates/report.md').read_text(encoding='utf-8')[:55000]+'\n\n'+marker+'\n\n此 PR 不自动修改已核验参数。请先核对来源，必要时补充 data/ 事实与构建产物，再合入。监测对照时间与事实核验日期不同。'
    title=f"官方来源检查：{len(report['changes'])} 项变化 / {len(report['errors'])} 项读取异常"
    try:
        result=api('/pulls',{'title':title,'head':branch,'base':default,'body':body,'draft':True})
        print('Review PR created: '+result['html_url'])
    except urllib.error.HTTPError as exc:
        if exc.code not in (403,422):raise
        body+='\n\n仓库未接受机器人PR。候选分支：`'+branch+'`；可在GitHub Compare页面从该分支发起PR。正式数据未改写。'
        result=api('/issues',{'title':title,'body':body})
        print('Review issue created: '+result['html_url'])


if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as exc:
        print(f'GitHub HTTP {exc.code}. Confirm that Actions may create pull requests in this repository. The inspection artifact is still available.')
        raise SystemExit(1)
