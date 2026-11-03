/**
 * دستیار هوش مصنوعی — Claude از سمت سرور. کلید API هرگز به مرورگر نمی‌رود.
 *
 * هوش مصنوعی پیش‌نویس می‌دهد؛ تأیید، بستن ماه و ارسال نهایی همیشه با آدم است.
 * بدون ANTHROPIC_API_KEY مسیر GET می‌گوید «خاموش» و رابط بخش‌های هوشمند را پنهان می‌کند.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const MODEL_COMPLEX = process.env.AI_MODEL_COMPLEX || 'claude-opus-5-5';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const enabled = () => !!process.env.ANTHROPIC_API_KEY;

export function GET() {
  return NextResponse.json({ on: enabled(), images: enabled() });
}

interface Body {
  /** گفت‌وگو؛ پیام اول دستور کار است */
  messages: { role: 'user' | 'assistant'; content: string }[];
  system?: string;
  json?: boolean;
  complex?: boolean;
  effort?: 'low' | 'medium' | 'high';
  images?: { media_type: string; data: string }[];
}

const fail = (code: string, status = 400) => NextResponse.json({ error: code }, { status });

/** اولین شیء یا آرایه‌ی JSON داخل متن پاسخ. */
function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/g, '').trim();
  const start = t.search(/[[{]/);
  if (start < 0) throw new Error('no json');
  const open = t[start]!;
  const close = open === '{' ? '}' : ']';
  const end = t.lastIndexOf(close);
  return JSON.parse(t.slice(start, end + 1));
}

export async function POST(req: Request) {
  if (!enabled()) return fail('sampling_disabled', 503);
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail('invalid_request');
  }
  const turns = (body.messages || []).filter((m) => m && typeof m.content === 'string' && m.content.trim());
  if (!turns.length || turns[0]!.role !== 'user') return fail('invalid_request');
  const size = JSON.stringify(turns).length;
  if (size > 400_000) return fail('prompt_too_large');

  const images = (body.images || []).slice(0, 5);
  for (const im of images)
    if (!IMAGE_TYPES.includes(im.media_type as ImageType) || im.data.length > 27_000_000) return fail('image_rejected');

  const messages: Anthropic.MessageParam[] = turns.map((m, i) =>
    i === 0 && images.length
      ? {
          role: 'user',
          content: [
            ...images.map(
              (im): Anthropic.ImageBlockParam => ({
                type: 'image',
                source: { type: 'base64', media_type: im.media_type as ImageType, data: im.data },
              }),
            ),
            { type: 'text', text: m.content },
          ],
        }
      : { role: m.role, content: m.content },
  );

  const client = new Anthropic();
  try {
    // fallbacks: اگر طبقه‌بند ایمنی درخواستی را رد کند، API همان درخواست را روی مدل جایگزین اجرا می‌کند
    const params = {
      model: body.complex ? MODEL_COMPLEX : MODEL,
      max_tokens: 16000,
      system: body.system,
      messages,
      output_config: { effort: body.effort || (body.complex ? 'high' : 'medium') },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;
    const res = await client.beta.messages.create(params, { signal: req.signal });
    if (res.stop_reason === 'refusal') return fail('refused', 422);
    const text = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    if (!text) return fail('empty_completion', 502);
    if (!body.json) return NextResponse.json({ text });
    try {
      return NextResponse.json({ json: extractJson(text) });
    } catch {
      return fail('invalid_json', 502);
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail('rate_limited', 429);
    if (e instanceof Anthropic.AuthenticationError) return fail('sampling_disabled', 503);
    if (e instanceof Anthropic.BadRequestError) return fail('invalid_request', 400);
    if (e instanceof Anthropic.APIUserAbortError) return fail('cancelled', 499);
    if (e instanceof Anthropic.APIError) return fail('upstream', 502);
    return fail('upstream', 502);
  }
}
