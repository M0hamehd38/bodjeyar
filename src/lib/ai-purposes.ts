/**
 * کاربردهای هوش مصنوعی بودجه‌یار — تنها فهرست مرجع (سمت مرورگر و سرور).
 *
 * مثل «هوش سازمانی»: دو مدل داریم و مدیر برای هر کاربرد یکی را انتخاب می‌کند —
 *   - «مدل دقیق»   (پیش‌فرض GPT-5.6-Luna — همان مدل «گام»)
 *   - «مدل روزمره» (پیش‌فرض DeepSeek-V4-Flash — همان مدل «ارزشیابی»)
 * در تنظیمات فقط «سطح» ذخیره می‌شود نه شناسه‌ی مدل، تا اگر روزی مدل دیگری جای
 * یکی نشست (ARVAN_PRECISE_MODEL / ARVAN_EVERYDAY_MODEL)، انتخاب مدیر بی‌اعتبار نشود.
 */

import type { AiTier } from './types';

export const AI_TIERS: readonly AiTier[] = ['precise', 'everyday'];

export const TIER_INFO: Record<AiTier, { label: string; note: string }> = {
  precise: {
    label: 'مدل دقیق',
    note: 'دقیق‌تر و کندتر — برای ساخت بودجه، خواندن سند، ایجنت و تحلیل‌های حساس (همان مدل «گام»)',
  },
  everyday: {
    label: 'مدل روزمره',
    note: 'سریع و کم‌هزینه — برای گفتگو، خلاصه و کارهای پرتکرار (همان مدل «ارزشیابی»)',
  },
};

export const AI_PURPOSES = {
  agent: {
    label: 'ایجنت مالی (کارهای چندمرحله‌ای)',
    description: 'بستن ماه، تدوین بودجه، برنامه‌ی وصول و پرداخت، گزارش هیئت‌مدیره — با ابزار و پیشنهاد قابل تأیید',
    tier: 'precise',
  },
  assistant: {
    label: 'دستیار هر صفحه',
    description: 'پرسش‌وپاسخ با داده‌های همان بخش (داشبورد، عملکرد، حساب‌ها، پرسنل، …)',
    tier: 'everyday',
  },
  budget_build: {
    label: 'ساخت پیش‌نویس بودجه',
    description: 'پر کردن ارقام بودجه از روی گفت‌وگو و عملکرد دوره‌ی قبل',
    tier: 'precise',
  },
  budget_chat: {
    label: 'گفت‌وگوی تدوین بودجه',
    description: 'پرسش‌های دستیار در ویزارد بودجه',
    tier: 'everyday',
  },
  doc_read: {
    label: 'خواندن سند و قبض',
    description: 'استخراج مبلغ‌ها از عکس یا متن سند حسابداری',
    tier: 'precise',
  },
  variance_reason: {
    label: 'پیشنهاد علت انحراف',
    description: 'علت محتمل و اقدام اصلاحی برای ردیف‌های قرمز و زرد',
    tier: 'everyday',
  },
  revision_suggest: {
    label: 'پیشنهاد اصلاحیه',
    description: 'پیشنهاد اصلاح ارقام بودجه از روی روند عملکرد',
    tier: 'precise',
  },
  report_summary: {
    label: 'خلاصه‌ی نوشتاری گزارش',
    description: 'خلاصه‌ی مدیریتی هر گزارش',
    tier: 'everyday',
  },
  dashboard_qa: {
    label: 'پرسش از داشبورد',
    description: 'پاسخ کوتاه به پرسش مدیر از ارقام داشبورد',
    tier: 'everyday',
  },
} as const satisfies Record<string, { label: string; description: string; tier: AiTier }>;

export type AiPurpose = keyof typeof AI_PURPOSES;
export const AI_PURPOSE_KEYS = Object.keys(AI_PURPOSES) as AiPurpose[];

export const isTier = (v: unknown): v is AiTier => v === 'precise' || v === 'everyday';

/** سطح مدل یک کاربرد: انتخاب مدیر، وگرنه پیش‌فرض همان کاربرد. */
export function tierFor(settings: Partial<Record<string, AiTier>> | undefined, purpose: AiPurpose): AiTier {
  const v = settings?.[purpose];
  return isTier(v) ? v : AI_PURPOSES[purpose].tier;
}
