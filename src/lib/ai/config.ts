/**
 * AI 运行时配置：读写 data/ai-config.json。
 *
 * 配置「视觉模型 + 文本模型」两个独立槽位：
 *   - visionModelId：视觉理解（户型识别）
 *   - textModelId：文本对话（AI 变更提案）
 * 两者可分别选择不同厂商模型（如 GPT-4o 视觉 + DeepSeek 文本），
 * 也可选同一模型。
 *
 * 与 .env 的分工：.env 为兜底默认，data/ai-config.json 运行时配置优先。
 * 密钥明文存本地文件，该文件已加入 .gitignore，不入库。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { AI_MODELS, aiModelById } from "./models.ts";

export type AiRuntimeConfig = {
  visionModelId: string;
  textModelId: string;
  /** modelId -> apiKey（明文，仅本地） */
  apiKeys: Record<string, string>;
};

const CONFIG_PATH = path.join(process.cwd(), "data", "ai-config.json");

function envKey(modelId: string): string | undefined {
  switch (modelId) {
    case "deepseek-chat":
    case "deepseek-reasoner":
      return process.env.DEEPSEEK_API_KEY;
    case "gpt-4o":
    case "gpt-4o-mini":
      return process.env.OPENAI_API_KEY;
    case "qwen-vl-max":
    case "qwen-plus":
      return process.env.CUSTOM_API_KEY;
    case "glm-4v":
    case "glm-4":
      return process.env.GLM_API_KEY;
    case "moonshot-v1":
      return process.env.MOONSHOT_API_KEY;
    case "doubao-vision":
      return process.env.DOUBAO_API_KEY;
    default:
      return undefined;
  }
}

/** 默认视觉模型：优先有视觉能力的模型 */
function defaultVisionModelId(): string {
  if (process.env.OPENAI_API_KEY) return "gpt-4o";
  if (process.env.CUSTOM_API_KEY) return "qwen-vl-max";
  return "gpt-4o";
}

function defaultTextModelId(): string {
  if (process.env.DEEPSEEK_API_KEY) return "deepseek-chat";
  if (process.env.OPENAI_API_KEY) return "gpt-4o";
  return "deepseek-chat";
}

export function defaultConfig(): AiRuntimeConfig {
  const keys: Record<string, string> = {};
  if (process.env.DEEPSEEK_API_KEY) {
    keys["deepseek-chat"] = process.env.DEEPSEEK_API_KEY;
    keys["deepseek-reasoner"] = process.env.DEEPSEEK_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    keys["gpt-4o"] = process.env.OPENAI_API_KEY;
    keys["gpt-4o-mini"] = process.env.OPENAI_API_KEY;
  }
  if (process.env.CUSTOM_API_KEY) {
    keys["qwen-vl-max"] = process.env.CUSTOM_API_KEY;
  }
  return {
    visionModelId: defaultVisionModelId(),
    textModelId: defaultTextModelId(),
    apiKeys: keys,
  };
}

export async function readConfig(): Promise<AiRuntimeConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AiRuntimeConfig> & { selectedModelId?: string };
    const def = defaultConfig();
    // 兼容旧的 { selectedModelId } 结构
    const legacy = parsed.selectedModelId;
    return {
      visionModelId: parsed.visionModelId ?? legacy ?? def.visionModelId,
      textModelId: parsed.textModelId ?? legacy ?? def.textModelId,
      apiKeys: { ...def.apiKeys, ...(parsed.apiKeys ?? {}) },
    };
  } catch {
    return defaultConfig();
  }
}

export async function writeConfig(patch: Partial<AiRuntimeConfig>): Promise<AiRuntimeConfig> {
  const current = await readConfig();
  const next: AiRuntimeConfig = {
    visionModelId: patch.visionModelId ?? current.visionModelId,
    textModelId: patch.textModelId ?? current.textModelId,
    apiKeys: { ...current.apiKeys, ...(patch.apiKeys ?? {}) },
  };
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

/** 解析某个槽位（vision/text）当前生效的模型与密钥 */
export async function resolveModel(kind: "vision" | "text"): Promise<{ model: (typeof AI_MODELS)[number]; apiKey: string } | null> {
  const cfg = await readConfig();
  const modelId = kind === "vision" ? cfg.visionModelId : cfg.textModelId;
  const model = aiModelById.get(modelId);
  if (!model) return null;
  const apiKey = cfg.apiKeys[model.id] || envKey(model.id);
  if (!apiKey) return null;
  return { model, apiKey };
}
