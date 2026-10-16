"""Set public repository links for a fork, without any credentials."""
import argparse
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--repository',required=True);args=parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',args.repository):raise SystemExit('Use owner/repository.')
(root/'data/project.json').write_text(json.dumps({'repository':args.repository},indent=2)+'\n',encoding='utf-8')
print('Repository links configured. Run npm run build.')
