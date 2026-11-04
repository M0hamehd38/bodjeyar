/** تبدیل بسته‌ی ورود اکسل به فایل پشتیبان بودجه‌یار (همان قالب «بازیابی از پشتیبان»). */
import type { ImportBundle } from './import-xlsx';
import type { Org, Settings } from './types';

export const IMPORT_COLLECTIONS = ['centers', 'heads', 'periods', 'versions', 'actuals', 'bills', 'entries', 'staff', 'accounts', 'capex'] as const;

export function importInfo(b: ImportBundle, file: string, by: string, at: string): NonNullable<Settings['import_info']> {
  return { file, at, by, counts: b.counts, warnings: b.warnings };
}

export function bundleToBackup(b: ImportBundle, org: Org, now: string, settings?: Partial<Settings>) {
  return {
    app: 'budgetyar' as const,
    version: 2 as const,
    exported_at: now,
    org,
    settings: {
      green: 5,
      yellow: 10,
      scen: { cons: { rev: -10, exp: 5 }, opt: { rev: 10, exp: -3 } },
      has_sample: false,
      ...settings,
      import_info: importInfo(b, 'excel', 'import', now),
    },
    centers: b.centers,
    heads: b.heads,
    periods: b.periods,
    versions: b.versions,
    actuals: b.actuals,
    bills: b.bills,
    variances: [],
    inv_track: [],
    entries: b.entries,
    staff: b.staff,
    accounts: b.accounts,
    capex: b.capex,
    proposals: [],
  };
}
