/**
 * 主流大模型目录。
 *
 * 每个模型标注能力（视觉 / 文本 / 生图）、优劣与本项目适配度。
 * 本项目三类 AI 能力与模型的对应关系：
 *   - 视觉理解（vision）：户型图尺寸链识别、房间分类
 *   - 文本对话（text）：AI 变更提案、自然语言交互
 *   - 图像生成（image）：材质贴图 / 风格参考图增强
 *
 * 端点与模型名以各厂商官方文档为准，使用时若厂商更新请同步修订。
 */

export type AiCapabilities = {
  vision: boolean; // 视觉理解（读图）
  text: boolean; // 纯文本对话
  image: boolean; // 图像生成
};

export type AiModelInfo = {
  /** 唯一 id（下拉值） */
  id: string;
  name: string;
  vendor: string;
  /** OpenAI 兼容端点 */
  baseURL: string;
  /** API 调用的 model 名 */
  model: string;
  capabilities: AiCapabilities;
  /** 优点 */
  pros: string[];
  /** 缺点 */
  cons: string[];
  /** 与本项目适配度说明 */
  fit: string;
  /** 适配度评分 1-5 */
  fitScore: number;
  /** 是否 OpenAI 兼容协议（本项目直连要求） */
  openAICompat: boolean;
};

export const AI_MODELS: AiModelInfo[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek-V3",
    vendor: "深度求索",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    capabilities: { vision: false, text: true, image: false },
    pros: ["文本能力强、逻辑清晰", "价格极低", "中文表现优秀", "OpenAI 兼容、接入快"],
    cons: ["不支持视觉理解", "不支持图像生成", "不适用看图识户型"],
    fit: "适配 AI 变更提案、文本问答；不适配户型识别（需视觉）。识别走本地 CV 兜底。",
    fitScore: 3,
    openAICompat: true,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek-R1",
    vendor: "深度求索",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-reasoner",
    capabilities: { vision: false, text: true, image: false },
    pros: ["深度推理、复杂逻辑强", "适合方案推敲与成本分析"],
    cons: ["推理耗时较长", "不支持视觉/生图", "非推理类场景性价比一般"],
    fit: "适配需要深度推理的文本任务（如预算优化建议）；不适配视觉识别。",
    fitScore: 3,
    openAICompat: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    vendor: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o",
    capabilities: { vision: true, text: true, image: false },
    pros: ["视觉理解强，户型图识别首选", "多模态综合能力均衡", "生态成熟"],
    cons: ["需官方密钥、有网络门槛", "成本相对较高"],
    fit: "全适配：户型识别（视觉）+ AI 提案（文本）。需配 gpt-image-1 做生图。",
    fitScore: 5,
    openAICompat: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o-mini",
    vendor: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    capabilities: { vision: true, text: true, image: false },
    pros: ["视觉+文本，成本比 gpt-4o 低", "识别性价比高"],
    cons: ["复杂识别精度略低于 gpt-4o", "仍需官方密钥"],
    fit: "适配户型识别与文本提案的高性价比组合。",
    fitScore: 4,
    openAICompat: true,
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    vendor: "UU API 中转",
    baseURL: "https://uuapi.io/v1",
    model: "gpt-5.3-codex",
    capabilities: { vision: true, text: true, image: false },
    pros: ["视觉+文本多模态", "代码与逻辑能力强", "国内直连"],
    cons: ["模型名随网关分组可能变化", "第三方中转，稳定性需自行评估"],
    fit: "适配户型识别（视觉）与文本提案，本 key 分组实测可用。",
    fitScore: 4,
    openAICompat: true,
  },
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    vendor: "UU API 中转",
    baseURL: "https://uuapi.io/v1",
    model: "gpt-5.6-sol",
    capabilities: { vision: true, text: true, image: false },
    pros: ["视觉+文本多模态，户型识别实测可用", "国内直连、免代理", "统一网关接入多家上游"],
    cons: ["模型名随网关分组可能变化", "第三方中转，稳定性需自行评估"],
    fit: "高适配：户型识别（视觉）+ 文本提案，国内可直连，本 key 实测识别成功。",
    fitScore: 5,
    openAICompat: true,
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    vendor: "UU API 中转",
    baseURL: "https://uuapi.io/v1",
    model: "gpt-6-astra",
    capabilities: { vision: true, text: true, image: false },
    pros: ["新一代模型，综合能力强", "视觉+文本多模态", "国内直连"],
    cons: ["模型名随网关分组可能变化", "中转稳定性需评估"],
    fit: "适配户型识别与文本提案（本 key 分组可用）。",
    fitScore: 5,
    openAICompat: true,
  },
  {
    id: "gpt-6-sol",
    name: "GPT-6 Sol",
    vendor: "UU API 中转",
    baseURL: "https://uuapi.io/v1",
    model: "gpt-6-sol",
    capabilities: { vision: true, text: true, image: false },
    pros: ["新一代模型，能力更强", "国内直连"],
    cons: ["模型名随网关分组可能变化", "中转稳定性需评估"],
    fit: "适配户型识别与文本提案（本 key 分组可用）。",
    fitScore: 5,
    openAICompat: true,
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    vendor: "UU API 中转",
    baseURL: "https://uuapi.io/v1",
    model: "gpt-6.1-sol",
    capabilities: { vision: true, text: true, image: false },
    pros: ["最新一代模型", "视觉+文本多模态", "国内直连"],
    cons: ["模型名随网关分组可能变化", "中转稳定性需评估"],
    fit: "适配户型识别与文本提案（本 key 分组可用）。",
    fitScore: 5,
    openAICompat: true,
  },
  {
    id: "qwen-vl-max",
    name: "通义千问 VL-Max",
    vendor: "阿里云",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-vl-max",
    capabilities: { vision: true, text: true, image: false },
    pros: ["中文视觉理解强、贴合国内户型图", "国内直连、免代理", "价格适中"],
    cons: ["生图需另配 wanx 模型", "视觉细节识别偶有偏差"],
    fit: "高适配：国内户型图识别首选，兼做文本提案。",
    fitScore: 5,
    openAICompat: true,
  },
  {
    id: "qwen-plus",
    name: "通义千问 Plus",
    vendor: "阿里云",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    capabilities: { vision: false, text: true, image: false },
    pros: ["中文文本强、便宜", "国内直连"],
    cons: ["无视觉"],
    fit: "适配 AI 文本提案；识别需另配 VL 模型。",
    fitScore: 3,
    openAICompat: true,
  },
  {
    id: "glm-4v",
    name: "智谱 GLM-4V",
    vendor: "智谱 AI",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4v",
    capabilities: { vision: true, text: true, image: false },
    pros: ["中文视觉理解好", "国内直连", "对图纸/图表识别友好"],
    cons: ["生图需另配 cogview", "模型名随版本可能调整"],
    fit: "高适配：国内户型图识别 + 文本提案。",
    fitScore: 4,
    openAICompat: true,
  },
  {
    id: "glm-4",
    name: "智谱 GLM-4",
    vendor: "智谱 AI",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4",
    capabilities: { vision: false, text: true, image: false },
    pros: ["中文文本强", "国内直连"],
    cons: ["无视觉"],
    fit: "适配文本提案；识别需另配 VL 模型。",
    fitScore: 3,
    openAICompat: true,
  },
  {
    id: "moonshot-v1",
    name: "Kimi（Moonshot）",
    vendor: "月之暗面",
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-32k",
    capabilities: { vision: false, text: true, image: false },
    pros: ["超长上下文", "中文文本质量高"],
    cons: ["无视觉/生图", "主要面向长文本"],
    fit: "适配长文档类文本任务；不适配户型识别。",
    fitScore: 2,
    openAICompat: true,
  },
  {
    id: "doubao-vision",
    name: "豆包视觉",
    vendor: "字节跳动",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-vision",
    capabilities: { vision: true, text: true, image: false },
    pros: ["视觉理解好、速度快", "国内直连"],
    cons: ["需先创建推理接入点（model 为接入点 ID）", "配置略繁琐"],
    fit: "适配户型识别；model 名需替换为你在火山方舟创建的接入点 ID。",
    fitScore: 4,
    openAICompat: true,
  },
];

export const aiModelById = new Map(AI_MODELS.map((m) => [m.id, m]));

/** 适配度中文标签 */
export function fitLabel(score: number): string {
  if (score >= 5) return "极佳";
  if (score >= 4) return "良好";
  if (score >= 3) return "一般";
  return "偏低";
}
