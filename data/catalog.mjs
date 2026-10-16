import {readFileSync} from 'node:fs';
import {applyReviewedUpdates} from './reviewed-updates.mjs';
import {addFrameworkModels,frameworkIndex} from './frameworks.mjs';
// 唯一数据源。每个字段都要写入来源、原文位置与核验状态。
import {addExpandedModels} from './expanded.mjs';
export const checked = '2026-10-15';
export const sources = {};
function source(url, title, vendor, kind='官方模型卡') {
  const found = Object.values(sources).find(s=>s.url===url);
  if(found) return found.id;
  const id='s'+String(Object.keys(sources).length+1).padStart(3,'0');
  sources[id]={id,url,title,vendor,kind,checked,revision:'main / 在线页面；未固定提交'};
  return id;
}
const f=(value,s,locator,note='',status)=>{const refs=Array.isArray(s)?s:[s];return {value,sources:refs,locator,note,status:status||(refs.every(id=>sources[id].kind==='官方配置')?'config':'verified'),checked};};
const u=(s,note='所查官方模型卡与配置未查得明确说明；不代表不支持。')=>f(null,s,'模型卡 / config.json',note,'not_found');
const na=(s,note)=>f(null,s,'架构说明',note,'not_applicable');
function base(repo,vendor,description){
  const card=source('https://huggingface.co/'+repo,repo+' · 模型卡',vendor);
  const config=source('https://huggingface.co/'+repo+'/raw/main/config.json',repo+' · config.json',vendor,'官方配置');
  return {id:repo.split('/')[1].toLowerCase().replaceAll('.','-'),name:repo.split('/')[1],repo,vendor,access:'weights',description,checked,card,config,fields:{}};
}
function experts(m,n,k,shared){const c=m.config;const prefix=m.vendor==='Kimi'||m.name.startsWith('Qwen3.5')?'text_config.':'';const expertKey=m.vendor==='Qwen'?'num_experts':m.vendor==='MiniMax'?'num_local_experts':'n_routed_experts';m.fields.arch=f('MoE',m.card,'模型介绍 / 架构');m.fields.routed=f(n,c,prefix+expertKey);m.fields.selected=f(k,c,prefix+'num_experts_per_tok');m.fields.shared=m.vendor==='Qwen'?f(shared,m.card,'Model Overview / Shared Experts'):f(shared,c,prefix+'n_shared_experts');}
const models=[];
for(const [name,total,active,routed,selected,layers] of [
  ['DeepSeek-V4-Flash',284,13,256,6,43],['DeepSeek-V4-Pro',1600,49,384,6,61]]){
  const m=base('deepseek-ai/'+name,'DeepSeek','V4 预览版；与带日期的正式版、DSpark 版本分别建档。');
  const card=name.endsWith('Pro')?source('https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash#model-downloads','DeepSeek-V4 · 官方下载与规格表','DeepSeek'):m.card;
  experts(m,routed,selected,1);m.fields.arch=f('MoE',card,'Introduction');
  Object.assign(m.fields,{
    total:f(total,card,'Model Downloads',total===1600?'作者公布主模型口径；1.6T 以 1600B 显示。':'作者公布主模型参数口径。'),active:f(active,card,'Model Downloads'),
    weight:f('FP4 + FP8',card,'Model Downloads / Precision','专家参数 FP4，多数其他参数 FP8；不等于全模型统一精度。'),
    quantization:f('FP4 专家 / FP8 混合', [card,m.config],'Precision 注释；expert_dtype / quantization_config','配置还声明 FP8 E4M3、动态激活、128×128 权重块。'),
    speculative:f('MTP · 配置声明',m.config,'num_nextn_predict_layers = 1','配置有 1 层 next-token prediction；此记录不代表部署性能已经实测。','config'),
    context:f('1,048,576',m.config,'max_position_embeddings','官方模型卡简称 1M；这里展示配置值，单位 token。'),layers:f(layers,m.config,'num_hidden_layers')});
  models.push(m);
}
{
  const m=base('deepseek-ai/DeepSeek-V4-Flash-0731','DeepSeek','带 DSpark 模块的正式版。严格区分原始 V4-Flash 预览版与本仓库。');experts(m,256,6,1);
  Object.assign(m.fields,{
    total:u(m.card,'本次所查版本说明未单列本仓库含 DSpark 模块的参数总量；不直接继承预览版。'),active:u(m.card,'本次所查版本说明未单列激活参数的数字口径。'),
    weight:f('FP4 + FP8',m.config,'expert_dtype = fp4；quant_method = fp8','配置还含 BF16 dtype 声明；混合精度不能只看 torch_dtype。','config'),
    quantization:f('FP4 专家 / FP8 混合',m.config,'expert_dtype / quantization_config','FP8 E4M3，动态激活，128×128 权重块。','config'),
    speculative:f('DSpark',m.card,'How to Run with vLLM / SGLang','官方提供 vLLM dspark 与 SGLang DSPARK 示例；参数和版本应以原文为准。'),
    context:f('1,048,576',m.config,'max_position_embeddings','配置值，单位 token。'),layers:f(43,m.config,'num_hidden_layers')});models.push(m);
}
for(const name of ['DeepSeek-V3','DeepSeek-V3.2','DeepSeek-R1']){
  const m=base('deepseek-ai/'+name,'DeepSeek',name==='DeepSeek-V3'?'主模型与附加 MTP 权重需要分别理解。':name==='DeepSeek-R1'?'这里收录完整 R1；不与 R1-Distill 或 R1-0528 混用。':'使用 DSA 的 V3.2；不与 V3.2-Exp、Speciale 混用。');experts(m,256,8,1);
  const spec=name==='DeepSeek-V3.2'?source('https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash#evaluation-results','DeepSeek 官方 V3.2 / V4 架构对照表','DeepSeek'):m.card;
  Object.assign(m.fields,{
    total:f(671,spec,name==='DeepSeek-V3.2'?'Base Model / # Total Params':'Model Downloads','作者公布的主模型参数口径。'),active:f(37,spec,name==='DeepSeek-V3.2'?'Base Model / # Activated Params':'Model Downloads'),
    weight:f('FP8 混合',m.config,'quantization_config；torch_dtype','配置含 FP8 量化与 BF16 dtype，不能标为全量 BF16。','config'),
    quantization:f('FP8 E4M3 · 128×128',m.config,'fmt / weight_block_size / activation_scheme','动态激活；此字段只描述本仓库，不汇总社区转换版。','config'),
    speculative:f('MTP · 配置声明',m.config,'num_nextn_predict_layers = 1','仅确认配置声明 1 层；权重可用性与部署算法另行核验。','config'),
    context:f(name==='DeepSeek-V3.2'?'163,840（配置）':'128K（模型卡）',name==='DeepSeek-V3.2'?m.config:m.card,name==='DeepSeek-V3.2'?'max_position_embeddings':'Model Downloads / Context Length',name==='DeepSeek-V3.2'?'展示配置上限，不视为服务商 API 承诺。':'配置上限为 163,840；此处保留官方模型卡的 128K 使用口径。'),layers:f(61,m.config,'num_hidden_layers')});
  models.push(m);
}
for(const version of ['2.6','2.5']){
 const m=base('moonshotai/Kimi-K'+version,'Kimi','原生多模态模型。官方另列 MoonViT 视觉编码器 400M 参数，不对 1T 口径擅自做加减。');experts(m,384,8,1);
 Object.assign(m.fields,{
  total:f(1000,m.card,'Model Summary / Total Parameters','保留官方约 1T 的公布精度，以 1000B 展示。'),active:f(32,m.card,'Model Summary / Activated Parameters'),
  weight:f('INT4 混合',m.card,'Native INT4 Quantization','不是全模型都以 INT4 存储。'),
  quantization:f('原生 INT4 · group 32',m.config,'text_config.quantization_config','4-bit 对称分组整数权重；配置列出 attention、共享专家、视觉模块等排除项。','config'),
  speculative:f('原生 MTP 层数 0',m.config,'text_config.num_nextn_predict_layers = 0','仅指该配置的原生 next-token prediction 层；不能据此否定外挂草稿模型或框架推测解码。','config'),
  context:f('262,144',m.config,'text_config.max_position_embeddings','模型卡简称 256K；单位 token。'),layers:f(61,m.card,'Model Summary / Number of Layers')});models.push(m);
}
for(const [name,total,active,n,layers] of [['gpt-oss-120b',117,5.1,128,36],['gpt-oss-20b',21,3.6,32,24]]){
 const m=base('openai/'+name,'OpenAI','模型名是版本名称；参数值采用作者在模型卡中公布的数字。');
 m.fields.arch=f('MoE',m.card,'Highlights / MoE weights');m.fields.routed=f(n,m.config,'num_local_experts');m.fields.selected=f(4,m.config,'num_experts_per_tok');
 m.fields.shared=u(m.config,'配置未单列共享专家数，本次未进一步核验实现；不把缺少配置键当作 0。');
 Object.assign(m.fields,{total:f(total,m.card,'模型介绍 / two flavors'),active:f(active,m.card,'模型介绍 / active parameters'),
  weight:f('MXFP4 混合',m.card,'Highlights / MXFP4 quantization','MXFP4 用于 MoE 权重，其他模块另有精度。'),quantization:f('MoE 权重 MXFP4',m.config,'quant_method / modules_to_not_convert','attention、router、embedding、lm_head 在排除量化列表中。','config'),
  speculative:u(m.card),context:f('131,072',m.config,'max_position_embeddings','配置值，单位 token。'),layers:f(layers,m.config,'num_hidden_layers')});models.push(m);
}
const qwenReport=source('https://arxiv.org/html/2505.09388v1#S2','Qwen3 Technical Report · §2 Architecture','Qwen','官方技术报告');
for(const [name,total,active] of [['Qwen3-235B-A22B',235,22],['Qwen3-30B-A3B',30.5,3.3],['Qwen3-32B',32.8,null]]){
 const m=base('Qwen/'+name,'Qwen','Qwen3 初版；不与带 2507 后缀的版本混用。');
 const fp8=source('https://huggingface.co/Qwen/'+name+'-FP8',name+'-FP8 · 官方量化版','Qwen');
 if(active){experts(m,128,8,0);m.fields.shared=f(0,qwenReport,'§2 Architecture / 无共享专家');}
 else{m.fields.arch=f('Dense',qwenReport,'§2 Architecture');for(const k of ['routed','selected','shared'])m.fields[k]=na(qwenReport,'Dense 模型，不适用 MoE 专家字段。');}
 Object.assign(m.fields,{total:f(total,m.card,'Model Overview / Number of Parameters'),active:active?f(active,m.card,'Model Overview / Activated Parameters'):na(m.card,'Dense 模型；官方模型卡未单列 MoE 式激活参数，不直接用总参数替代。'),
  weight:f('BF16',m.config,'torch_dtype / dtype','指原始模型仓库；官方另有 FP8 仓库。','config'),quantization:f('另有官方 FP8',fp8,'Note on FP8 / 模型说明','这里只列出已核实的官方 FP8 版，不代表穷尽全部官方量化版本。'),
  speculative:u([m.card,m.config]),context:f('32,768 → 131,072',m.card,'Model Overview / Context Length','左侧原生长度；右侧经 YaRN 扩展。单位 token。')});models.push(m);
}
for(const [name,total,active,n,k] of [['Qwen3-Next-80B-A3B-Instruct',80,3,512,10],['Qwen3.5-35B-A3B',35,3,256,8]]){
 const m=base('Qwen/'+name,'Qwen',name.startsWith('Qwen3.5')?'多模态模型；35B / 3B 是模型卡中 Language Model 部分的口径。':'混合注意力与高稀疏 MoE；此记录为 Instruct 版本。');experts(m,n,k,1);
 const fp8=source('https://huggingface.co/Qwen/'+name+'-FP8',name+'-FP8 · 官方量化版','Qwen');
 Object.assign(m.fields,{total:f(total,m.card,'Model Overview',name.startsWith('Qwen3.5')?'语言模型部分，不与整个多模态检查点的自动权重统计等同。':''),active:f(active,m.card,'Model Overview'),weight:f('BF16',m.config,'torch_dtype / dtype','原始仓库精度，官方另有 FP8 版。','config'),quantization:f('另有官方 FP8',fp8,'Note on FP8','细粒度块量化；以独立官方量化仓库为准。'),
  speculative:f('原生 MTP',[m.card,m.config],name.startsWith('Qwen3.5')?'Model Overview；mtp_num_hidden_layers = 1':'Deployment / Multi-Token Prediction',name.startsWith('Qwen3.5')?'官方介绍多步训练的 MTP；实际部署需匹配框架版本。':'官方给出 SGLang NEXTN 与 vLLM qwen3_next_mtp 示例。'),
  context:f('262,144 → 1,010,000',m.card,'Model Overview / Context Length','左侧原生；右侧扩展。单位 token。')});models.push(m);
}
for(const [name,total,active,n,context] of [['GLM-5',744,40,256,'202,752'],['GLM-4.5',355,32,160,'131,072'],['GLM-4.5-Air',106,12,128,'131,072']]){
 const m=base('zai-org/'+name,'GLM','参数量采用作者公布值，不用 Hugging Face 自动张量统计覆盖模型卡。');experts(m,n,8,1);
 const fp8=source('https://huggingface.co/zai-org/'+name+'-FP8',name+'-FP8 · 官方量化版','GLM');
 const deploy=name==='GLM-4.5-Air'?source('https://huggingface.co/zai-org/GLM-4.5#system-requirements','GLM-4.5 系列 · 官方部署说明','GLM'):m.card;
 Object.assign(m.fields,{total:f(total,m.card,'Introduction / Model Introduction'),active:f(active,m.card,'Introduction / Model Introduction'),weight:f('BF16',m.config,'torch_dtype / dtype','原始仓库，另有官方 FP8 版本。','config'),quantization:f('另有官方 FP8',fp8,'官方 FP8 模型卡'),
  speculative:f('MTP',[deploy,m.config],'Deploy / SGLang；num_nextn_predict_layers = 1','官方有 MTP 部署说明；SGLang 示例中的 EAGLE 是框架启用路径，应结合原文理解。'),
  context:f(context,m.config,'max_position_embeddings','配置值，单位 token；不与服务商 API 上限等同。')});models.push(m);
}
for(const name of ['MiniMax-M2','MiniMax-M2.5']){
 const m=base('MiniMaxAI/'+name,'MiniMax','精度与 MTP 以官方配置为准。配置声明不等于本项目已验证推理引擎的实际支持。');experts(m,256,8,0);
 m.fields.arch=f('MoE',m.config,'model_type / num_local_experts','官方 minimax_m2 配置的专家结构。','config');
 m.fields.shared=f(0,m.config,'shared_intermediate_size = 0','根据官方配置解释为无共享专家。','config');
 Object.assign(m.fields,{total:name==='MiniMax-M2'?f(230,m.card,'Meet MiniMax M2'):u(m.card,'所查 M2.5 正文未直接明示，不沿用 M2 数值，也不采用平台自动统计值。'),active:name==='MiniMax-M2'?f(10,m.card,'Meet MiniMax M2'):u(m.card,'所查 M2.5 正文未直接明示，不从相同架构名推导激活参数。'),
  weight:f('FP8 混合',m.config,'quantization_config','部分模块排除量化，不能视作所有权重都为 FP8。','config'),quantization:f('FP8 E4M3 · 128×128',m.config,'quantization_config','动态激活；配置列出排除量化模块。','config'),
  speculative:f('MTP · 配置声明',m.config,'use_mtp / num_mtp_modules / num_mtp_layers','use_mtp 为 true；3 个模块，每模块 1 层。未核实发布权重的 MTP 可用性或具体部署算法。','config'),context:f('196,608',m.config,'max_position_embeddings','配置值，单位 token。')});models.push(m);
}
addExpandedModels({models,sources,source,f,u,na,base,experts,checked});
addFrameworkModels({models,sources,source,f,u,na,checked});
export { models };
export const fieldDefinitions={
 sglang:{label:'SGLang 支持证据',description:'区分具体部署示例、模板选项、混合服务架构和仅目录占位；目录未列出不等于不支持。未本机实测，部署条件见原页。'},
 vllm:{label:'vLLM 支持证据',description:'区分具体仓库示例与架构级列入；相同架构不保证所有量化、硬件、特性都可用。latest文档快照，不代表任意已安装版本。'},
 total:{label:'总参数 / 标注范围',unit:'B',description:'采用作者公布口径，范围可能是主模型或语言部分，必须同时读范围说明。带“推导”的值依据官方等结构关系或组件计算，不能当作作者直接公布的完整检查点总量。B = 10⁹，T = 10¹²。'},
 active:{label:'激活参数 / token',unit:'B',description:'作者公布的每 token 激活参数，不是权重驻留大小，也不能直接换算显存。Dense 模型未单列时保留不适用。'},
 arch:{label:'模型架构',description:'MoE（混合专家）或 Dense（稠密）；不能根据名称或参数量自行猜测。'},
 routed:{label:'路由专家 / 层',description:'单个 MoE 层的路由专家池，不是全网络所有层专家总和，也不包含单独列出的共享专家。'},
 selected:{label:'每 token 路由激活',description:'每个 token 在单个 MoE 层选中的路由专家数量；共享专家另列。'},
 shared:{label:'共享专家 / 层',description:'单个 MoE 层始终参与的共享专家。0 必须有证据；缺少某个配置键不能自动解释为 0。'},
 weight:{label:'原始仓库发布精度',description:'当前记录对应仓库的权重精度。dtype 声明不覆盖 quantization_config，混合精度应逐模块理解。'},
 quantization:{label:'官方量化信息',description:'区分原仓库精度与独立官方量化仓库。仅列本次已核实版本，不代表全部支持方式；社区 AWQ/GPTQ/GGUF 转换不冒充开发方发布。'},
 speculative:{label:'推测解码 / MTP',description:'区分模型原生模块、配置声明与框架部署方案。MTP 层数 0 不代表不能使用外部草稿模型；思考模式与推测解码也不是同一概念。'},
 context:{label:'上下文长度 / token',description:'原生、扩展、配置上限与 API 限制分别标明。箭头表示原生 → 扩展；配置值不保证服务端接受同样长度。'},
 layers:{label:'主干层数',description:'仅在本次核实到官方数值时列出；不默认包含附加草稿模块或视觉编码器层。'},
 auxiliary:{label:'附加模块 / 参数范围',description:'单列官方披露的视觉、条件记忆、N-gram 或推测解码模块。不使用量化文件字节数推导逻辑参数，也不默认所有组件被计入主模型数字。'}
};

export const snapshot=applyReviewedUpdates(models,sources,JSON.parse(readFileSync(new URL('./reviewed-updates.json',import.meta.url),'utf8')));

for(const x of frameworkIndex.entries)x.modelId=models.find(m=>m.repo.toLowerCase()===x.repo?.toLowerCase())?.id||null;
