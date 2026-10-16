# Model Atlas · 模型档案

逐字段保留官方出处的大模型技术资料库：查询参数，也核对数字的口径。

[English](README.en.md) · [数据口径](docs/DATA_POLICY.md) · [更新机制](docs/MAINTENANCE.md) · [部署说明](docs/DEPLOYMENT.md) · [参与贡献](CONTRIBUTING.md)

## 当前内容

- **88 个参数档案**：总参数、每token激活参数、MoE/Dense、路由/共享专家、选中专家、发布精度、官方量化、推测解码/MTP、上下文、层数及附加模块。
- **697 个框架模型/变体索引**：来自 SGLang 112 篇cookbook和vLLM 225行文字/多模态架构记录。索引包含第三方变体、独立草稿与占位页，不等同于697个参数完整的档案。
- 参数档案有 **275 条来源**；事实快照为 **2026-10-15**。来源监测运行时间和事实核验日期分别记录。
- 搜索、别名匹配、筛选、最多4款对比、浏览器收藏、详情出处及CSV/JSON导出。中文界面，可离线使用。

覆盖 DeepSeek、Qwen、GLM、Kimi、书生、MiniMax、StepFun、Llama、Gemma、gpt-oss、Inkling等。具体版本与字段完整度以档案为准。闭源API未披露的结构保持未知。

## 直接使用

下载仓库 ZIP 并解压，或克隆本仓库，然后用浏览器打开 [`dist/index.html`](dist/index.html)。不需要安装第三方依赖；查看外部来源需要联网。收藏保存在当前浏览器。

维护者启用GitHub Pages后，可通过仓库首页的网页地址在线访问；GitHub Actions部署成功前，不把预计地址当作已上线网址。

数据文件可直接使用：

- [`dist/data.json`](dist/data.json)：模型、逐字段来源、证据状态、日期和框架索引。
- [`dist/catalog.csv`](dist/catalog.csv)：逐字段规格及来源，适合表格查询。
- [`dist/framework-index.csv`](dist/framework-index.csv)：框架引用、支持等级与出处。

## 本地开发

需要 Node.js 22+；来源检查和打包另需 Python 3.10+，均只使用标准库。

```bash
git clone https://github.com/Kangkaibo/model-atlas.git
cd model-atlas
npm run build
npm run check
npm test
npm start
```

本机预览地址为 `http://127.0.0.1:4317`。静态文件使用相对路径，可部署到GitHub Pages的项目子路径。

## 定时维护

已提供GitHub Actions：

1. **CI**：提交和PR时构建、校验数据与来源引用、运行来源检查器测试，检查生成文件是否同步。
2. **Pages**：合入`main`后检查并部署`dist/`，也支持手动运行。
3. **Official source audit**：默认每周一北京时间09:00检查官方仓库、文档和新模型候选；也支持手动触发。生成带固定配置链接与差异的待审报告，不自动改写正式参数。
4. **Release**：推送`v*`标签时检查、打包并发布离线网站与源码ZIP。

监测到变化后通常生成草稿PR；若仓库限制机器人创建PR，则生成Issue并附候选分支。维护者核验原文、修订参数数据，通过检查并合入后，网站才发布新资料。没有变化不反复创建相同更新单。详见[维护流程](docs/MAINTENANCE.md)。

GitHub计划任务可能延迟，长期不活跃的公开仓库可能暂停计划任务；这不是实时抓取或无人审核的参数生成器。

## 证据原则

| 状态 | 含义 |
| --- | --- |
| `verified` | 模型开发方直接公布 |
| `config` | 对应官方配置的明确字段 |
| `framework` | SGLang / vLLM官方文档；与模型作者披露分开 |
| `derived` | 有完整来源链、前提、范围及限制的有限推导 |
| `not_found` | 本次所查来源未找到明确说明 |
| `not_applicable` | 此字段不适用 |

不根据型号名称、文件字节数或专家选中比例补造激活参数；作者主模型口径、完整checkpoint张量统计和附加MTP/视觉组件分别保留。框架表中未列不等于不支持；配置里出现模块也不等于任何引擎均可运行。

## 项目结构

```text
data/                  人工核验的数据、来源及监测对照
dist/                  可直接使用的静态网站和导出数据
scripts/               构建、校验、来源检查、打包及更新提案
tests/                 来源变化、读取失败、未知字段等行为测试
docs/                  数据规则、部署、维护及参考项目
.github/workflows/     检查、部署、定时维护和发布
```

## 贡献与许可

新增或纠错请附作者官方链接、原文位置、具体版本与参数范围。未查到的信息保留未知，使用[贡献指南](CONTRIBUTING.md)或Issue模板提交。

本项目原创代码和文档使用[MIT许可证](LICENSE)。第三方模型卡、技术报告、网站内容及模型权重的权利仍归其原作者；本项目许可不授予模型权重使用权。参考项目见[REFERENCES.md](docs/REFERENCES.md)。
