import {readFileSync} from 'node:fs';
const revisions=JSON.parse(readFileSync(new URL('./revisions.json',import.meta.url),'utf8'));
export function addExpandedModels({models,sources,source,f,u,na,base,experts,checked}){
 const pin=m=>{const sha=revisions[m.repo];if(sha){sources[m.card].url='https://huggingface.co/'+m.repo+'/blob/'+sha+'/README.md';sources[m.card].revision=sha;sources[m.config].url='https://huggingface.co/'+m.repo+'/raw/'+sha+'/config.json';sources[m.config].revision=sha;}return m;};
 const dense=m=>{m.fields.arch=f('Dense',m.config,'architectures / model_type','按官方实现配置确定稠密架构。','config');m.fields.active=na(m.card,'作者未单列每 token 激活参数，不直接用总量替代。');for(const k of ['routed','selected','shared'])m.fields[k]=na(m.config,'Dense，不适用 MoE 专家字段。');};
 const derived=(value,refs,scope,premises,note)=>({...f(value,refs,'官方模型关系 / 组件说明',note,'derived'),scope,derivation:{premises,resultScope:scope,limitation:'不包含未经单独核实的附加模块参数；不是作者对本版本完整检查点的直接公布。'}});
 const setScope=(fact,scope)=>({...fact,scope});

 // 同架构的官方关系可以用于主干规格推导，但不外推附加模块或发布精度。
 const originalFlash=models.find(m=>m.name==='DeepSeek-V4-Flash');
 const originalPro=models.find(m=>m.name==='DeepSeek-V4-Pro');
 const dsparkFlash=base('deepseek-ai/DeepSeek-V4-Flash-DSpark','DeepSeek','官方说明为原检查点附加推测解码模块。主模型口径与完整检查点口径分列。');
 experts(dsparkFlash,256,6,1);
 Object.assign(dsparkFlash.fields,{
   total:derived(284,[dsparkFlash.card,originalFlash.card],'主模型，不含 DSpark 草稿模块',['官方 DSpark 模型卡说明：同一检查点附加推测解码模块。','原 Flash 官方规格表：主模型 284B。'],'284B 引用原主模型口径；没有核实含草稿模块的完整总量。'),
   active:derived(13,[dsparkFlash.card,originalFlash.card],'目标主模型 / token',['DSpark 保留原目标模型并附加草稿模块。','原 Flash 官方披露目标模型 13B/token 激活。'],'不包含推测执行时额外草稿与验证计算；不是运行时平均激活总量。'),
   weight:f('FP4 + FP8',dsparkFlash.config,'expert_dtype / quantization_config','混合精度。'),quantization:f('FP4 专家 / FP8 混合',dsparkFlash.config,'expert_dtype；quantization_config','只描述此仓库。'),
   speculative:f('DSpark',dsparkFlash.card,'Note / How to Run with vLLM'),context:f('1,048,576',dsparkFlash.config,'max_position_embeddings'),layers:f(43,dsparkFlash.config,'num_hidden_layers'),
   auxiliary:u(dsparkFlash.card,'草稿模块已确认存在，但本次官方材料未单列其逻辑参数量；完整检查点总量待核验。')});models.push(dsparkFlash);
 const flash0731=models.find(m=>m.name==='DeepSeek-V4-Flash-0731');
 flash0731.fields.total=derived(284,[flash0731.card,dsparkFlash.card,originalFlash.card],'主模型，不含 DSpark 草稿模块',['0731 官方卡明确与 Flash-DSpark 模型结构相同。','DSpark 官方卡说明为原检查点附加推测解码模块。','原 Flash 官方规格主模型为 284B。'],'依据三段官方关系推导主模型规格；不作为含 DSpark 模块的完整参数总量。');
 flash0731.fields.active=derived(13,[flash0731.card,dsparkFlash.card,originalFlash.card],'目标主模型 / token',['0731 与 DSpark 同结构。','DSpark 保留原目标主模型结构。','原 Flash 目标模型激活量为 13B/token。'],'只推导目标主模型一次前向激活口径，不包含草稿计算。');
 flash0731.fields.auxiliary=u(flash0731.card,'确认附带 DSpark；其模块参数及完整检查点总量本次未单独核实。');
 for(const name of ['DeepSeek-V4-Pro-DSpark','DeepSeek-V4-Pro-0813']){
  const m=pin(base('deepseek-ai/'+name,'DeepSeek','官方 Pro 结构附加 DSpark 模块；以主模型口径记录参数。'));experts(m,384,6,1);
  Object.assign(m.fields,{total:derived(1600,[m.card,originalPro.card],'主模型，不含 DSpark 草稿模块',['官方介绍说明基于 V4-Pro 预览版的主模型结构，附加 DSpark 模块。','原 Pro 官方规格主模型为 1.6T。'],'1.6T 换算为 1600B；完整检查点总量未单列。'),active:derived(49,[m.card,originalPro.card],'目标主模型 / token',['官方指向原 Pro 主模型结构。','原 Pro 官方披露 49B/token 激活。'],'不包含额外草稿执行。'),weight:f('FP4 + FP8',m.config,'expert_dtype / quantization_config'),quantization:f('FP4 专家 / FP8 混合',m.config,'expert_dtype / quantization_config'),speculative:f('DSpark',m.card,'官方部署示例 / How to Run with vLLM'),context:f('1,048,576',m.config,'max_position_embeddings'),layers:f(61,m.config,'num_hidden_layers'),auxiliary:u(m.card,'附加草稿模块量与完整检查点总量未单列。')});models.push(m);
 }

 // Qwen 最近开放权重版本，参数均按卡中的 Language Model 范围。
 for(const [name,total,active,n,k,layers] of [
  ['Qwen3.5-397B-A17B',397,17,512,10,60],['Qwen3.5-122B-A10B',122,10,256,8,48],['Qwen3.5-27B',27,null,null,null,64],['Qwen3.6-35B-A3B',35,3,256,8,40],['Qwen3.6-27B',27,null,null,null,64],['Qwen3.8-Flash-NEXT',125,6,512,10,48]]){
  const m=pin(base('Qwen/'+name,'Qwen','官方开放权重版本；语言主干、视觉与附加模块口径分开。'));
  if(n){m.fields.arch=f('MoE',m.card,'Model Overview / Mixture Of Experts');m.fields.routed=f(n,m.config,'text_config.num_experts');m.fields.selected=f(k,m.config,'text_config.num_experts_per_tok');m.fields.shared=f(1,m.card,'Model Overview / Activated Experts：Routed + Shared');}else dense(m);
  Object.assign(m.fields,{total:setScope(f(total,m.card,'Model Overview / Language Model / Number of Parameters'),'语言主干'),weight:f('BF16',m.config,'text_config.dtype','当前原始仓库 dtype；不等同于所有官方量化版。'),quantization:u([m.card,m.config],'本次核验此原始仓库的 BF16 声明，未穷尽独立官方量化仓库。'),speculative:f('原生 MTP',[m.card,m.config],'Model Overview；text_config.mtp_num_hidden_layers = 1','官方多步 MTP 训练声明，部署以模型卡为准。'),context:f(name.includes('3.8')?'262,144 → 1,000,000':'262,144 → 1,010,000',m.card,'Model Overview / Context Length','原生 → 扩展；单位 token。'),layers:f(layers,m.config,'text_config.num_hidden_layers')});
  if(active!==null)m.fields.active=setScope(f(active,m.card,'Language Model / activated parameters'),'语言主干 / token');
  if(name.includes('3.8')){m.fields.total.scope='125B 主干，另有 N-gram / MTP';m.fields.total.note='官方分别列出125B、51B N-gram 与4B MTP，不把125B当作整个检查点的总量。';m.fields.auxiliary=f('N-gram 51B；MTP 4B',m.card,'Model Overview / Language Model','保留官方组件分列，视觉参数是否包含需另行核验。');}
  models.push(m);
 }

 // API 服务单独建档。服务端参数未知，不把相似名称当成架构映射。
 for(const name of ['Qwen3.7-Plus','Qwen3.7-Max','Qwen3.7-Flash','Qwen3.8-Max','Qwen3.8-Flash','Qwen3.6-Plus']){
  const apiId=name.toLowerCase();const card=source('https://www.qwencloud.com/models/'+apiId,name+' · 官方 API 服务规格','Qwen','官方服务文档');
  const m={id:apiId.replaceAll('.','-'),name,repo:apiId,vendor:'Qwen',access:'api',description:'官方 API 服务标识，与同名或相近开放权重仓库不自动等同。此条记录服务文档明确给出的规格。',checked,card,config:null,fields:{}};
  for(const k of ['total','active','arch','routed','selected','shared','weight','quantization','speculative'])m.fields[k]=u(card,'本次官方 API 服务规格未给出此字段；不能从 Plus / Max / Flash 名称或能力排名反推。');
  m.fields.context=f('1M（API 服务）',card,'Rate Limits & Context / Context','保留官网服务口径，不转换为开放权重配置值。');models.push(m);
 }

 // 书生及其视觉语言系列。
 {
  const m=base('internlm/Intern-S1-Pro','书生','书生科学多模态推理模型；保留官方1T/22B公布精度。');
  Object.assign(m.fields,{total:f(1000,m.card,'Introduction','官方1T以1000B展示，不是精确张量计数。'),active:f(22,m.card,'Introduction'),arch:f('MoE',m.card,'Introduction'),routed:f(512,m.config,'text_config.num_experts'),selected:f(8,m.config,'text_config.num_experts_per_tok'),shared:u(m.config,'官方配置未单列共享专家数，本次未核实实现，不默认填0。'),weight:f('FP8 混合',m.config,'quantization_config','部分模块排除量化。'),quantization:f('FP8 E4M3 · 128×128',m.config,'quantization_config','动态激活，UE8M0 scale，部分模块排除。'),speculative:u([m.card,m.config]),context:f('262,144',m.config,'text_config.max_position_embeddings'),layers:f(94,m.config,'text_config.num_hidden_layers')});models.push(m);
 }
 {
  const m=base('internlm/Intern-S1','书生','官方分别披露235B语言MoE与6B视觉编码器；完整激活参数未单列。');
  Object.assign(m.fields,{total:derived(241,[m.card],'官方披露组件的近似合计',['官方模型卡给出235B语言MoE。','同一模型卡给出6B视觉编码器。','235 + 6 = 241B；组件本身为作者取整值。'],'仅为已披露组件的近似相加，不宣称穷尽连接层等全部参数。'),active:u(m.card,'未单列完整多模态激活参数，不借用Qwen3的22B当作整模型激活量。'),arch:f('MoE',m.card,'Introduction'),routed:f(128,m.config,'text_config.num_experts'),selected:f(8,m.config,'text_config.num_experts_per_tok'),shared:u(m.config),weight:f('BF16',m.config,'torch_dtype'),quantization:u(m.config,'原始配置没有量化声明；不代表没有其他官方版本。'),speculative:u([m.card,m.config]),context:f('65,536',m.config,'text_config.max_position_embeddings'),auxiliary:f('语言235B；视觉6B',m.card,'Introduction','主模型字段约241B为组件近似合计。')});models.push(m);
 }
 for(const [repo,display,total,factor] of [['internlm3-8b-instruct','InternLM3-8B-Instruct',8,6],['internlm2_5-20b-chat','InternLM2.5-20B-Chat',20,2.5]]){
  const m=base('internlm/'+repo,'书生','书生稠密语言模型；思考模式与推测解码分开。');m.name=display;dense(m);
  Object.assign(m.fields,{total:f(total,m.card,'Introduction'),weight:f('BF16',m.config,'torch_dtype'),quantization:u(m.config),speculative:u([m.card,m.config]),context:f('32,768（配置）',m.config,'max_position_embeddings / rope_scaling','dynamic RoPE factor='+factor+'；不将位置长度乘factor擅自当官方上下文。')});
  if(repo.includes('2_5')){const gguf=source('https://huggingface.co/internlm/internlm2_5-20b-chat-gguf','书生 InternLM2.5-20B · 官方 GGUF','书生');m.fields.quantization=f('官方 GGUF / Q5 / Q6 / Q8',gguf,'Introduction','官方列FP16、q5_0、q5_k_m、q6_k、q8_0等。');}models.push(m);
 }
 {
  const m=base('OpenGVLab/InternVL3_5-30B-A3B','书生','书生视觉语言系列，发布账号OpenGVLab；官方模型表区分视觉与语言参数。');m.name='InternVL3.5-30B-A3B';
  Object.assign(m.fields,{total:f(30.8,m.card,'InternVL3.5 Family / Github Format','视觉0.3B + 语言30.5B的官方总量。'),active:f(3,m.card,'InternVL3.5 Family / 30.8B-A3B','采用官方A3B型号口径，不以此宣称视觉编码计算已全部包含。'),arch:f('MoE',m.config,'llm_config.model_type = qwen3_moe'),routed:f(128,m.config,'llm_config.num_experts'),selected:f(8,m.config,'llm_config.num_experts_per_tok'),shared:u(m.config),weight:f('BF16',m.config,'torch_dtype'),quantization:u(m.config),speculative:u([m.card,m.config]),context:f('40,960（配置）',m.config,'llm_config.max_position_embeddings'),auxiliary:f('视觉0.3B；语言30.5B',m.card,'InternVL3.5 Family / Github Format')});models.push(m);
 }

 // 其他国内常用系列。
 {
  const m=base('baidu/ERNIE-4.5-300B-A47B-PT','文心 ERNIE','百度官方文本MoE；PT为PyTorch格式，原仓精度与在线量化示例分开。');
  Object.assign(m.fields,{total:f(300,m.card,'Model Overview'),active:f(47,m.card,'Model Overview'),arch:f('MoE',m.card,'Model Overview'),routed:f(64,m.config,'moe_num_experts'),selected:f(8,m.config,'moe_k'),shared:f(0,m.config,'moe_num_shared_experts'),weight:f('BF16',m.config,'torch_dtype'),quantization:f('官方示例：在线 FP8',m.card,'Quickstart / --quantization fp8','这是引擎在线量化示例，不是原始仓库已量化成FP8。'),speculative:f('MTP · 配置声明',m.config,'num_nextn_predict_layers = 1','仅确认nextn配置1层，未据此断言已发布可用草稿权重。'),context:f('131,072',m.config,'max_position_embeddings'),layers:f(54,m.config,'num_hidden_layers')});models.push(m);
 }
 {
  const m=base('tencent/Hunyuan-A13B-Instruct','混元 Hunyuan','腾讯官方MoE；模型卡使用256K上下文口径，配置与扩展参数另注。');
  const fp8=source('https://huggingface.co/tencent/Hunyuan-A13B-Instruct-FP8','混元A13B · 官方FP8','混元 Hunyuan');const int4=source('https://huggingface.co/tencent/Hunyuan-A13B-Instruct-GPTQ-Int4','混元A13B · 官方GPTQ-Int4','混元 Hunyuan');
  Object.assign(m.fields,{total:f(80,m.card,'Model Introduction'),active:f(13,m.card,'Model Introduction'),arch:f('MoE',m.card,'Model Introduction'),routed:f(64,m.config,'num_experts'),selected:f(8,m.config,'moe_topk / per-layer array'),shared:f(1,m.config,'num_shared_expert / per-layer array'),weight:f('BF16',m.config,'torch_dtype'),quantization:f('另有官方 FP8 / GPTQ-Int4',[fp8,int4],'官方量化模型卡'),speculative:u(m.card),context:f('256K（模型卡）',[m.card,m.config],'Model Introduction；max_position_embeddings','原配置32768，dynamic RoPE alpha=1000、factor=1。保留官方模型卡与配置两种口径。')});models.push(m);
 }
 {
  const m=base('inclusionAI/Ling-1T','蚂蚁 Ling','inclusionAI官方万亿MoE。训练采用FP8不等于原始仓库权重就是FP8。');
  Object.assign(m.fields,{total:f(1000,m.card,'Introduction','官方1T取整口径。'),active:f(50,m.card,'Introduction','作者约50B激活口径。'),arch:f('MoE',m.card,'Introduction'),routed:f(256,m.config,'n_routed_experts'),selected:f(8,m.config,'num_experts_per_tok'),shared:f(1,m.config,'n_shared_experts'),weight:f('BF16',m.config,'torch_dtype'),quantization:f('FP8 训练；BF16 原仓',[m.card,m.config],'Pre-Training / torch_dtype','卡说明FP8混合精度训练；不把训练精度当发布权重精度。'),speculative:f('MTP · 训练架构声明',m.card,'Pre-Training / MTP layers','未核实实际推测解码部署与独立模块参数。'),context:f('32K → 128K（YaRN）',[m.card,m.config],'Model Downloads / vLLM 部署','原config为32768且rope_scaling=null；官方部署要求额外设置YaRN factor4。'),layers:f(80,m.config,'num_hidden_layers')});models.push(m);
 }

 // 近期主要开放模型。
 {
  const m=pin(base('zai-org/GLM-5.3-Flash','GLM','GLM-5系列原生多模态、稀疏与线性混合注意力。'));
  Object.assign(m.fields,{total:f(320,m.card,'Introduction'),active:f(18,m.card,'Introduction'),arch:f('MoE',m.config,'text_config.n_routed_experts'),routed:f(288,m.config,'text_config.n_routed_experts'),selected:f(8,m.config,'text_config.num_experts_per_tok'),shared:f(1,m.config,'text_config.n_shared_experts'),weight:f('FP8 混合',m.config,'quantization_config','配置同时有BF16 dtype，实际量化配置为FP8。'),quantization:f('FP8 E4M3 · 128×128',m.config,'quantization_config','动态激活。'),speculative:f('MTP · 配置声明',m.config,'text_config.num_nextn_predict_layers = 1','只确认原生nextn配置。'),context:f('1,048,576',m.config,'text_config.max_position_embeddings'),layers:f(45,m.config,'text_config.num_hidden_layers')});models.push(m);
 }
 {
  const m=pin(base('MiniMaxAI/MiniMax-M3','MiniMax','官方原生多模态模型；参数使用作者约数。'));
  Object.assign(m.fields,{total:f(428,m.card,'Introduction','官方约428B，保留取整口径。'),active:f(23,m.card,'Introduction','官方约23B激活。'),arch:f('MoE',m.config,'text_config.num_local_experts'),routed:f(128,m.config,'text_config.num_local_experts'),selected:f(4,m.config,'text_config.num_experts_per_tok'),shared:f(1,m.config,'text_config.n_shared_experts'),weight:f('BF16',m.config,'torch_dtype'),quantization:u(m.config,'当前所查原仓为BF16 dtype，未穷尽其他官方量化发布。'),speculative:f('MTP · 配置声明',m.config,'text_config.num_nextn_predict_layers = 1'),context:f('1,048,576',m.config,'text_config.max_position_embeddings'),layers:f(60,m.config,'text_config.num_hidden_layers')});models.push(m);
 }
 {
  const m=pin(base('moonshotai/Kimi-K3','Kimi','KDA与AttnRes架构，官方给出2.8T/104B及原生MXFP4量化。'));
  Object.assign(m.fields,{total:f(2800,m.card,'Model Summary / Total Parameters','2.8T以2800B展示。'),active:f(104,m.card,'Model Summary / Activated Parameters'),arch:f('MoE',m.card,'Model Summary'),routed:f(896,m.card,'Model Summary / Number of Experts'),selected:f(16,m.card,'Model Summary / Selected Experts per Token'),shared:f(2,m.card,'Model Summary / Number of Shared Experts'),weight:f('MXFP4 混合',m.card,'Native MXFP4 Quantization'),quantization:f('MXFP4 权重 / MXFP8 激活',m.card,'Native MXFP4 Quantization','官方量化感知训练；不视为所有模块统一精度。'),speculative:f('原生 MTP 层数 0',m.config,'text_config.num_nextn_predict_layers = 0','不代表不能外挂草稿模型。'),context:f('1,048,576',m.config,'text_config.max_position_embeddings'),layers:f(93,m.card,'Model Summary / Number of Layers')});models.push(m);
 }
 {
  const m=pin(base('deepseek-ai/DeepSeek-V4.1-Flash','DeepSeek','多模态CED架构，预填充与解码激活量不同，不能压成单一数字。'));
  Object.assign(m.fields,{total:setScope(f(552,m.card,'Introduction / backbone parameters'),'主干口径'),active:f('8B（Prefill）/ 16B（Decode）',m.card,'Architecture / CED','阶段不同；不拿其中一个作为所有请求的平均激活量。'),arch:f('MoE',m.card,'Introduction'),routed:f(384,m.config,'text_config.n_routed_experts'),selected:f(6,m.config,'text_config.num_experts_per_tok'),shared:f(1,m.config,'text_config.n_shared_experts'),weight:f('FP8 混合',m.config,'quantization_config'),quantization:f('FP8 · 32×32',m.config,'quantization_config','动态激活，UE8M0 scale；不与KV缓存FP4混淆。'),speculative:f('DSpark',m.card,'Additional architectural components'),context:f('1,048,576',m.config,'text_config.max_position_embeddings'),layers:f(40,m.config,'text_config.num_hidden_layers','官方CED主干20层encoder+20层decoder。'),auxiliary:f('Engram 条件记忆 196B',m.card,'Additional architectural components','官方单列条件记忆参数；不与552B主干口径擅自求和或相减。')});models.push(m);
 }
 for(const [repo,total,active,layers] of [['gemma-4-31B-it',30.7,null,60],['gemma-4-26B-A4B-it',25.2,3.8,30]]){
  const m=pin(base('google/'+repo,'Google Gemma','Google DeepMind官方Gemma4；型号名称和模型卡参数数字分开。'));
  if(active===null)dense(m);else{m.fields.arch=f('MoE',m.card,'Mixture-of-Experts Model');m.fields.routed=f(128,m.card,'Expert Count');m.fields.selected=f(8,m.card,'Expert Count');m.fields.shared=f(1,m.card,'Expert Count');m.fields.active=f(active,m.card,'Active Parameters');}
  Object.assign(m.fields,{total:f(total,m.card,active===null?'Dense Models / 31B Dense / Total Parameters':'Mixture-of-Experts Model / Total Parameters','官方规格表另列约550M视觉编码器，保留原表口径不自行加减。'),weight:f('BF16',m.config,'dtype / text_config.dtype'),quantization:u(m.config,'未在此原始仓库核实量化配置；不代表没有其他官方版本。'),speculative:u([m.card,m.config]),context:f('262,144',m.config,'text_config.max_position_embeddings'),layers:f(layers,m.config,'text_config.num_hidden_layers'),auxiliary:f('视觉编码器约550M',m.card,'Vision Encoder Parameters','保留官方单列数值，不擅自解释是否已包含在Total Parameters中。')});models.push(m);
 }
}
