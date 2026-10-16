# Model Atlas

A source-linked reference for LLM specifications and inference-framework support. [中文](README.md)

The current snapshot includes 115 specification records and 701 framework model/variant references. A framework reference is not a fully verified specification record. Facts were reviewed on 2026-10-16; monitoring dates are separate.

Download or clone this repository and open `dist/index.html`. The Chinese-language interface works offline; source links require Internet access. Search, filters, comparison, local favorites, and CSV/JSON export are included.

For development: Node.js 22+ and Python 3.10+, no third-party runtime dependencies.

```bash
npm run build
npm run check
npm test
npm start
```

Generated data: [JSON](dist/data.json), [specification CSV](dist/catalog.csv), [framework CSV](dist/framework-index.csv).

GitHub workflows provide CI, Pages deployment, weekly official-source inspections and tagged ZIP releases. Inspections propose review changes; they never silently change verified parameter claims. Review missing values, checkpoint/author counting scope, MoE experts, quantization variants, MTP modules, and framework version constraints before publishing updates.

See [data policy](docs/DATA_POLICY.md), [maintenance](docs/MAINTENANCE.md), [deployment](docs/DEPLOYMENT.md), and [contributing](CONTRIBUTING.md).

Original code and documentation: MIT. Third-party source documents and model weights retain their own rights and licenses.

Coverage audit: 33 publisher namespaces, 2,695 generation-tagged repositories, including older releases. Pending candidates are searchable separately and are never counted as reviewed parameter records. See [the coverage report](docs/COVERAGE_AUDIT.md).
