/**
 * آرم و نام سایپا استوار — هویت بصری مشترک «میز کار سازمانی» و «ارزشیابی».
 *
 * آرم برداری است (بازسازی‌شده از لوگوی رسمی روی شبکه‌ی ۳۰/۶۰ درجه) تا در هر
 * اندازه و در PDF تیز بماند. نام با فونت Estedad حروف‌چینی می‌شود، نه تصویر.
 * همان path در apps/api/src/collab/brand.ts برای سربرگ نامه‌ها تکرار شده است.
 */

export const SAIPA_MARK_PATH =
  'M88 15.5 L132 15.5 L132 134.5 L29.5 194 L7 156 L88 109.2 Z M238 15.5 L194 15.5 L194 134.5 L296.5 194 L319 156 L238 109.2 Z M141 15 L163 4 L185 15 L185 139 L292 201 L292 228 L272 240 L163 177 L54 240 L34 228 L34 201 L141 139 Z M163 190 L263 248 L242.5 286 L163 240 L83.5 286 L63 248 Z';

export function BrandMark({
  size = 32,
  color = '#FF7900',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 326 292"
      width={size}
      height={(size * 292) / 326}
      className={className}
      role="img"
      aria-label="سایپا"
    >
      <path fill={color} d={SAIPA_MARK_PATH} />
    </svg>
  );
}

/**
 * آرم + «سایپا / نمایندگی استوار» — مثل سربرگ پوستر رسمی.
 * `tone="dark"` برای زمینه‌ی سرمه‌ای (نوار کناری)، `light` برای زمینه‌ی روشن.
 */
export function BrandLockup({
  tone = 'light',
  size = 'md',
  subtitle,
}: {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}) {
  const mark = size === 'lg' ? 52 : size === 'md' ? 38 : 30;
  const title = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-lg';
  const sub = size === 'lg' ? 'text-base' : 'text-xs';
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={mark} />
      <span className={`h-9 w-px ${tone === 'dark' ? 'bg-white/20' : 'bg-slate-300'}`} />
      <div className="leading-tight">
        <div className={`${title} font-black tracking-tight text-brand-500`}>سایپا</div>
        <div className={`${sub} font-bold ${tone === 'dark' ? 'text-white' : 'text-navy-900'}`}>
          {subtitle ?? 'نمایندگی استوار'}
        </div>
      </div>
    </div>
  );
}
