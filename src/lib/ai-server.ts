/**
 * لایه‌ی سرور هوش مصنوعی — فقط سمت سرور (کلیدها هرگز به مرورگر نمی‌روند).
 *
 * نام متغیرهای محیطی عیناً همان «هوش سازمانی» و «ارزشیابی» است تا یک ‎.env برای
 * هر سه سامانه کار کند:
 *
 *   AI_PROVIDER=arvan|openai|anthropic   (پیش‌فرض: هر کدام که کلیدش هست، اول آروان)
 *   ARVAN_AI_BASE_URL، ARVAN_AI_API_KEY، ARVAN_CHAT_MODEL
 *   ARVAN_PRECISE_MODEL=GPT-5.6-Luna       — «مدل دقیق» (همان «گام»)
 *   ARVAN_EVERYDAY_MODEL=DeepSeek-V4-Flash — «مدل روزمره» (همان «ارزشیابی»)
 *   ARVAN_PRECISE_AI_BASE_URL / ARVAN_PRECISE_AI_API_KEY   (اختیاری؛ کلید جدای مدل دقیق)
 *   ARVAN_EVERYDAY_AI_BASE_URL / ARVAN_EVERYDAY_AI_API_KEY (اختیاری؛ کلید جدای مدل روزمره)
 *   OPENAI_API_KEY، OPENAI_BASE_URL، OPENAI_PRECISE_MODEL، OPENAI_EVERYDAY_MODEL
 *   ANTHROPIC_API_KEY، ANTHROPIC_PRECISE_MODEL، ANTHROPIC_EVERYDAY_MODEL
 *   AI_ENABLED=0 همه‌ی قابلیت‌های هوشمند را خاموش می‌کند.
 *
 * هوش مصنوعی اختیاری است: بدون کلید، برنامه کامل کار می‌کند و فقط بخش‌های هوشمند پنهان‌اند.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AiTier } from './types';

export type Env = Record<string, string | undefined>;
export type ProviderName = 'arvan' | 'openai' | 'anthropic';

export const cleanEnv = (v: string | undefined) => {
  if (v === undefined) return undefined;
  const t = v.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  return t === '' ? undefined : t;
};

export interface TierEndpoint {
  baseUrl?: string;
  apiKey?: string;
  model: string;
}

export interface AiConfig {
  enabled: boolean;
  configured: boolean;
  provider: ProviderName;
  tiers: Record<AiTier, TierEndpoint & { on: boolean }>;
  timeoutMs: number;
  maxRetries: number;
  missing: string[];
}

export function loadAiConfig(env: Env = process.env): AiConfig {
  const e = (k: string) => cleanEnv(env[k]);
  const enabledRaw = e('AI_ENABLED');
  const enabled = enabledRaw === undefined || !/^(0|false|no|off)$/i.test(enabledRaw);
  const explicit = e('AI_PROVIDER');
  const provider: ProviderName =
    explicit === 'arvan' || explicit === 'openai' || explicit === 'anthropic'
      ? explicit
      : e('ARVAN_AI_API_KEY') || e('ARVAN_PRECISE_AI_API_KEY') || e('ARVAN_EVERYDAY_AI_API_KEY')
        ? 'arvan'
        : e('OPENAI_API_KEY')
          ? 'openai'
          : e('ANTHROPIC_API_KEY')
            ? 'anthropic'
            : 'arvan';

  const missing: string[] = [];
  let tiers: Record<AiTier, TierEndpoint>;
  if (provider === 'arvan') {
    const base = e('ARVAN_AI_BASE_URL') ?? 'https://api.arvancloudai.ir/v1';
    const key = e('ARVAN_AI_API_KEY');
    tiers = {
      precise: {
        baseUrl: e('ARVAN_PRECISE_AI_BASE_URL') ?? base,
        apiKey: e('ARVAN_PRECISE_AI_API_KEY') ?? key,
        model: e('ARVAN_PRECISE_MODEL') ?? 'GPT-5.6-Luna',
      },
      everyday: {
        baseUrl: e('ARVAN_EVERYDAY_AI_BASE_URL') ?? base,
        apiKey: e('ARVAN_EVERYDAY_AI_API_KEY') ?? key,
        model: e('ARVAN_EVERYDAY_MODEL') ?? e('ARVAN_CHAT_MODEL') ?? 'DeepSeek-V4-Flash',
      },
    };
    if (!tiers.precise.apiKey && !tiers.everyday.apiKey) missing.push('ARVAN_AI_API_KEY');
  } else if (provider === 'openai') {
    const base = e('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
    const key = e('OPENAI_API_KEY');
    const chat = e('OPENAI_CHAT_MODEL');
    tiers = {
      precise: { baseUrl: base, apiKey: key, model: e('OPENAI_PRECISE_MODEL') ?? chat ?? 'gpt-5.1' },
      everyday: { baseUrl: base, apiKey: key, model: e('OPENAI_EVERYDAY_MODEL') ?? chat ?? 'gpt-5.1-mini' },
    };
    if (!key) missing.push('OPENAI_API_KEY');
  } else {
    const key = e('ANTHROPIC_API_KEY');
    tiers = {
      precise: { apiKey: key, model: e('ANTHROPIC_PRECISE_MODEL') ?? e('AI_MODEL_COMPLEX') ?? 'claude-opus-5-5' },
      everyday: { apiKey: key, model: e('ANTHROPIC_EVERYDAY_MODEL') ?? e('AI_MODEL') ?? 'claude-sonnet-5-5' },
    };
    if (!key) missing.push('ANTHROPIC_API_KEY');
  }
  const n = (k: string, d: number) => {
    const x = Number(e(k));
    return Number.isInteger(x) && x >= 0 ? x : d;
  };
  return {
    enabled,
    configured: enabled && missing.length === 0,
    provider,
    tiers: {
      precise: { ...tiers.precise, on: enabled && !!tiers.precise.apiKey },
      everyday: { ...tiers.everyday, on: enabled && !!tiers.everyday.apiKey },
    },
    timeoutMs: n('AI_REQUEST_TIMEOUT_MS', 180_000) || 180_000,
    maxRetries: n('AI_MAX_RETRIES', 2),
    missing,
  };
}

/* ------------------------------ پیام و ابزار ------------------------------ */

export interface ToolCall {
  id: string;
  name: string;
  /** رشته‌ی JSON همان‌طور که مدل داده */
  arguments: string;
}
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface ChatOptions {
  tier: AiTier;
  tools?: ToolDef[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  images?: { media_type: string; data: string }[];
  signal?: AbortSignal;
}
export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  finish: 'stop' | 'length' | 'tool_calls' | 'refusal' | 'other';
  model: string;
  usage?: { input: number; output: number };
}

export class AiFail extends Error {
  constructor(
    readonly code: string,
    readonly status = 502,
    detail?: string,
  ) {
    super(detail || code);
  }
}

/** آروان طرح `apikey` می‌خواهد نه `Bearer`؛ کلیدی که پنل می‌دهد خودش «apikey …» است. */
export const arvanAuth = (k: string) => (/^(apikey|bearer)\s/i.test(k.trim()) ? k.trim() : `apikey ${k.trim()}`);

/* ------------------------------ سازگار با OpenAI (آروان، OpenAI) ------------------------------ */

async function openAiChat(cfg: AiConfig, t: TierEndpoint, messages: ChatMessage[], o: ChatOptions): Promise<ChatResult> {
  const auth = cfg.provider === 'arvan' ? arvanAuth(t.apiKey!) : `Bearer ${t.apiKey}`;
  const firstUser = messages.findIndex((m) => m.role === 'user');
  const body = {
    model: t.model,
    messages: messages.map((m, i) => {
      if (i === firstUser && o.images?.length)
        return {
          role: 'user',
          content: [
            ...o.images.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.media_type};base64,${im.data}` } })),
            { type: 'text', text: m.content },
          ],
        };
      return {
        role: m.role,
        content: m.content,
        ...(m.tool_calls?.length
          ? { tool_calls: m.tool_calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) }
          : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.role === 'tool' && m.name ? { name: m.name } : {}),
      };
    }),
    ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
    ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
    ...(o.json && !o.tools?.length ? { response_format: { type: 'json_object' } } : {}),
    ...(o.tools?.length
      ? { tools: o.tools.map((x) => ({ type: 'function', function: { name: x.name, description: x.description, parameters: x.parameters } })) }
      : {}),
  };

  let last: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    const timeout = AbortSignal.timeout(cfg.timeoutMs);
    const signal = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout;
    try {
      const res = await fetch(`${t.baseUrl!.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth },
        body: JSON.stringify(body),
        signal,
      });
      if (res.status === 401 || res.status === 403) throw new AiFail('sampling_disabled', 503, await res.text());
      if (res.status === 429) throw new AiFail('rate_limited', 429);
      if (res.status === 413) throw new AiFail('prompt_too_large', 413);
      if (res.status >= 400 && res.status < 500) {
        const txt = (await res.text()).slice(0, 600);
        // مدلی که تصویر یا response_format را نمی‌پذیرد: یک بار بی آن
        if (o.json && /response_format/i.test(txt)) {
          return openAiChat(cfg, t, messages, { ...o, json: false });
        }
        throw new AiFail(/image/i.test(txt) ? 'image_rejected' : 'invalid_request', 400, txt);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as {
        model?: string;
        choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const ch = j.choices?.[0];
      const calls = (ch?.message?.tool_calls ?? []).map((c, i) => ({ id: c.id || `call_${i}`, name: c.function.name, arguments: c.function.arguments || '{}' }));
      const fr = ch?.finish_reason;
      return {
        content: ch?.message?.content ?? '',
        toolCalls: calls,
        finish: calls.length ? 'tool_calls' : fr === 'length' ? 'length' : fr === 'content_filter' ? 'refusal' : 'stop',
        model: j.model ?? t.model,
        usage: { input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0 },
      };
    } catch (e) {
      if (e instanceof AiFail) throw e;
      if (o.signal?.aborted) throw new AiFail('cancelled', 499);
      last = e;
      if (attempt < cfg.maxRetries) await new Promise((r) => setTimeout(r, 2 ** attempt * 600 + Math.random() * 300));
    }
  }
  throw new AiFail('upstream', 502, String(last));
}

/* ------------------------------ Anthropic ------------------------------ */

type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

async function anthropicChat(t: TierEndpoint, messages: ChatMessage[], o: ChatOptions): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: t.apiKey });
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const out: Anthropic.MessageParam[] = [];
  let firstUser = true;
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      const block: Anthropic.ToolResultBlockParam = { type: 'tool_result', tool_use_id: m.tool_call_id || '', content: m.content };
      const prev = out.at(-1);
      if (prev && prev.role === 'user' && Array.isArray(prev.content) && prev.content.every((b) => b.type === 'tool_result'))
        (prev.content as Anthropic.ToolResultBlockParam[]).push(block);
      else out.push({ role: 'user', content: [block] });
      continue;
    }
    if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.tool_calls || []) {
        let input: unknown = {};
        try {
          input = JSON.parse(c.arguments || '{}');
        } catch {
          /* */
        }
        blocks.push({ type: 'tool_use', id: c.id, name: c.name, input });
      }
      out.push({ role: 'assistant', content: blocks.length ? blocks : '…' });
      continue;
    }
    if (firstUser && o.images?.length) {
      out.push({
        role: 'user',
        content: [
          ...o.images.map((im): Anthropic.ImageBlockParam => ({ type: 'image', source: { type: 'base64', media_type: im.media_type as ImageType, data: im.data } })),
          { type: 'text', text: m.content },
        ],
      });
    } else out.push({ role: 'user', content: m.content });
    firstUser = false;
  }
  try {
    const res = await client.messages.create(
      {
        model: t.model,
        max_tokens: o.maxTokens ?? 16000,
        ...(system ? { system } : {}),
        messages: out,
        ...(o.tools?.length
          ? { tools: o.tools.map((x) => ({ name: x.name, description: x.description, input_schema: x.parameters as Anthropic.Tool.InputSchema })) }
          : {}),
      },
      { signal: o.signal },
    );
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    const calls = res.content.flatMap((b) => (b.type === 'tool_use' ? [{ id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) }] : []));
    return {
      content: text,
      toolCalls: calls,
      finish: res.stop_reason === 'tool_use' ? 'tool_calls' : res.stop_reason === 'refusal' ? 'refusal' : res.stop_reason === 'max_tokens' ? 'length' : 'stop',
      model: res.model,
      usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiFail('rate_limited', 429);
    if (e instanceof Anthropic.AuthenticationError) throw new AiFail('sampling_disabled', 503);
    if (e instanceof Anthropic.BadRequestError) throw new AiFail('invalid_request', 400, e.message);
    if (e instanceof Anthropic.APIUserAbortError) throw new AiFail('cancelled', 499);
    throw new AiFail('upstream', 502, String(e));
  }
}

/** یک دور گفت‌وگو با مدل انتخاب‌شده. اگر مدلِ آن سطح کلید ندارد، سطح دیگر جایش می‌نشیند. */
export async function chat(cfg: AiConfig, messages: ChatMessage[], o: ChatOptions): Promise<ChatResult> {
  if (!cfg.configured) throw new AiFail('sampling_disabled', 503);
  let tier = o.tier;
  if (!cfg.tiers[tier].on) tier = tier === 'precise' ? 'everyday' : 'precise';
  const t = cfg.tiers[tier];
  if (!t.on) throw new AiFail('sampling_disabled', 503);
  return cfg.provider === 'anthropic' ? anthropicChat(t, messages, o) : openAiChat(cfg, t, messages, o);
}

/** اولین شیء یا آرایه‌ی JSON داخل متن پاسخ. */
export function extractJson(text: string): unknown {
  const s = text.replace(/```(?:json)?/g, '').trim();
  const start = s.search(/[[{]/);
  if (start < 0) throw new Error('no json');
  const close = s[start] === '{' ? '}' : ']';
  return JSON.parse(s.slice(start, s.lastIndexOf(close) + 1));
}
