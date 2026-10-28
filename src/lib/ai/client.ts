import sharp from "sharp";
import type { ZodType } from "zod";
import { resolveModel } from "./config.ts";
import type { AiModelInfo } from "./models.ts";

/**
 * AI Provider 抽象层（运行时配置版）。
 *
 * 模型与密钥由 data/ai-config.json 运行时配置（界面可改），
 * 回退 .env 兜底。全部走 OpenAI 兼容协议，按模型的 capabilities
 * 决定三类能力（视觉/文本/生图）是否可用。
 *
 * 设计原则：
 *   1. 任何 AI 调用失败都返回 null，不抛错 —— 上层必须能静默降级到本地链路。
 *   2. 结构化输出必须用 zod 校验，校验不通过视为失败（温度 0 + 一次重试）。
 *   3. 图片先压缩再发送，控制 token 成本。
 */

type ActiveProvider = { model: AiModelInfo; apiKey: string };

async function getVision(): Promise<ActiveProvider | null> {
  return resolveModel("vision");
}

async function getText(): Promise<ActiveProvider | null> {
  return resolveModel("text");
}

export async function hasVision(): Promise<boolean> {
  const p = await getVision();
  return Boolean(p && p.model.capabilities.vision);
}

export async function hasText(): Promise<boolean> {
  const p = await getText();
  return Boolean(p && p.model.capabilities.text);
}

export async function hasImage(): Promise<boolean> {
  const p = await getText();
  return Boolean(p && p.model.capabilities.image);
}

/** 活动 AI 状态摘要，供 UI 显示（视觉/文本分别汇报） */
export async function aiStatus() {
  const [v, t] = await Promise.all([getVision(), getText()]);
  const vision = Boolean(v && v.model.capabilities.vision);
  const text = Boolean(t && t.model.capabilities.text);
  return {
    available: vision || text,
    vision,
    text,
    image: false,
    visionModelName: vision ? v!.model.name : null,
    textModelName: text ? t!.model.name : null,
    reason: vision || text ? "" : "未配置 AI 模型或密钥",
  };
}

/** 压缩并转 base64（控制在 1536px 长边，JPEG q80） */
export async function toVisionDataUrl(bytes: Buffer): Promise<string> {
  const buf = await sharp(bytes, { failOn: "none" })
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function stripCodeFence(text: string): string {
  let s = text.trim();
  const fences = ["```json", "```JSON", "```"];
  for (const f of fences) {
    if (s.startsWith(f)) {
      s = s.slice(f.length);
      break;
    }
  }
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

/** 从文本中挖出最外层的 JSON 对象，容忍前后有多余说明文字 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

async function callChatJson(
  p: ActiveProvider,
  payload: { messages: unknown[]; temperature: number; max_tokens: number },
): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${p.model.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model.model,
          ...payload,
          ...(attempt === 0 ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!res.ok) {
        if (attempt === 0) continue;
        return null;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content ?? "";
      if (!raw) {
        if (attempt === 0) continue;
        return null;
      }
      let text = stripCodeFence(raw);
      if (!text.startsWith("{")) {
        const extracted = extractJsonObject(text);
        if (!extracted) {
          if (attempt === 0) continue;
          return null;
        }
        text = extracted;
      }
      try {
        return JSON.parse(text);
      } catch {
        if (attempt === 0) continue;
        return null;
      }
    } catch {
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

export type VisionJsonOptions<T> = {
  images: Buffer[];
  system?: string;
  prompt: string;
  schema: ZodType<T>;
  maxTokens?: number;
};

/** 视觉理解，返回结构化 JSON。无视觉能力或失败返回 null。 */
export async function visionJson<T>(
  opts: VisionJsonOptions<T>,
): Promise<{ data: T; provider: string } | null> {
  const p = await getVision();
  if (!p || !p.model.capabilities.vision) return null;

  const dataUrls = await Promise.all(opts.images.map(toVisionDataUrl));
  if (dataUrls.length === 0) return null;

  const messages: unknown[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({
    role: "user",
    content: [
      { type: "text", text: opts.prompt },
      ...dataUrls.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } })),
    ],
  });

  const parsed = await callChatJson(p, {
    messages,
    temperature: 0,
    max_tokens: opts.maxTokens ?? 4000,
  });
  if (parsed === null) return null;
  const validated = opts.schema.safeParse(parsed);
  if (!validated.success) return null;
  return { data: validated.data, provider: p.model.name };
}

/** 纯文本结构化对话。无文本能力或失败返回 null。 */
export async function chatJson<T>(
  opts: { system?: string; prompt: string; schema: ZodType<T>; maxTokens?: number },
): Promise<{ data: T; provider: string } | null> {
  const p = await getText();
  if (!p || !p.model.capabilities.text) return null;

  const messages: unknown[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const parsed = await callChatJson(p, {
    messages,
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 2000,
  });
  if (parsed === null) return null;
  const validated = opts.schema.safeParse(parsed);
  if (!validated.success) return null;
  return { data: validated.data, provider: p.model.name };
}

/**
 * 生成图片，返回 PNG/WebP 字节。
 * 当前模型目录未接生图能力（生图需独立模型如 gpt-image-1/wanx/cogview），
 * 故恒返回 null，上层回退到程序化贴图。
 */
export async function generateImage(_prompt: string): Promise<Buffer | null> {
  return null;
}

/** 测试某模型 + 密钥的连接是否可用（发最小文本请求） */
export async function testConnection(modelId: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  const { aiModelById } = await import("./models.ts");
  const model = aiModelById.get(modelId);
  if (!model) return { ok: false, message: "未知模型" };
  if (!model.openAICompat) return { ok: false, message: "该模型非 OpenAI 兼容协议，暂不支持直连" };
  if (!apiKey) return { ok: false, message: "请先填写 API Key" };

  try {
    const res = await fetch(`${model.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
      }),
    });
    if (res.ok) return { ok: true, message: "连接成功，密钥有效" };
    const text = await res.text();
    const status = res.status;
    if (status === 401) return { ok: false, message: "密钥无效（401 未授权），请检查 API Key" };
    if (status === 404) return { ok: false, message: `模型名可能错误（404）：${model.model}，请核对厂商文档` };
    return { ok: false, message: `连接失败（HTTP ${status}）：${text.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, message: `网络错误：${(e as Error).message}` };
  }
}
