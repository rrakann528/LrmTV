import { db, siteSettingsTable } from "@workspace/db";

let _settingsMap = new Map<string, string>();

export async function refreshSettingsCache(): Promise<void> {
  try {
    const rows = await db.select().from(siteSettingsTable);
    _settingsMap = new Map(rows.map(s => [s.key, s.value]));
  } catch { /* DB not ready yet */ }
}

export function getCachedSetting(key: string, fallback = ""): string {
  return _settingsMap.get(key) ?? fallback;
}

refreshSettingsCache();
setInterval(refreshSettingsCache, 60_000);
