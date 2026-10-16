"""Create redistributable offline site and clean source ZIPs using explicit directory allowlists."""
import argparse
import hashlib
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE_DIRS=('data','dist','scripts','tests','docs','.github')
SOURCE_FILES=('README.md','README.en.md','LICENSE','CONTRIBUTING.md','CHANGELOG.md','CITATION.cff','package.json','.gitignore','.gitattributes','updates/pending.json','updates/report.md')


def source_files(root=ROOT):
    for name in SOURCE_FILES:
        if (root/name).is_file():yield root/name
    for name in SOURCE_DIRS:
        for path in sorted((root/name).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ('.pyc','.zip'):
                yield path


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'artifacts');args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    archives=[]
    for name,files,prefix in [('model-atlas-offline.zip',sorted((ROOT/'dist').rglob('*')),''),('model-atlas-source.zip',source_files(),'model-atlas/')]:
        target=args.output/name
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
            for path in files:
                if path.is_file():archive.write(path,prefix+path.relative_to(ROOT/'dist' if not prefix else ROOT).as_posix())
            if not prefix:archive.writestr('README.txt','Model Atlas\nExtract the entire archive and open index.html. Source links need Internet access. Unknown facts remain unknown.\n')
        archives.append(target)
    (args.output/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in archives),encoding='utf-8')
    print('Created offline/source ZIPs and SHA256SUMS.txt.')


if __name__=='__main__':main()
