/**
 * Runtime flags for Document Depot (no database).
 * Set vars in Netlify → Site configuration → Environment variables (no redeploy needed for many plans).
 *
 * Option A — one JSON object (leader id → truthy):
 *   EMAIL_PROFILE_IOS_LIVE_JSON = {"kevin-dickerson":true,"troy-dixon":true}
 *
 * Option B — per person (suffix uses underscores; maps to leader id with hyphens):
 *   EMAIL_IOS_LIVE_KEVIN_DICKERSON = 1
 *   (kevin-dickerson)
 */

export const handler = async () => {
  const env = process.env;
  const iosLive = {};

  const bulk = env.EMAIL_PROFILE_IOS_LIVE_JSON || env.EMAIL_IOS_LIVE_JSON;
  if (bulk) {
    try {
      const j = JSON.parse(bulk);
      if (j && typeof j === 'object') {
        for (const [leaderId, v] of Object.entries(j)) {
          if (v === true || v === 1 || v === '1' || v === 'live' || v === 'true' || v === 'yes') {
            iosLive[String(leaderId)] = true;
          }
        }
      }
    } catch {
      /* ignore bad JSON */
    }
  }

  const prefix = 'EMAIL_IOS_LIVE_';
  for (const key of Object.keys(env)) {
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    if (!suffix) continue;
    const val = env[key];
    if (val !== '1' && val !== 'true' && val !== 'yes' && val !== 'live') continue;
    const slug = suffix.toLowerCase().replace(/_/g, '-');
    iosLive[slug] = true;
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
    body: JSON.stringify({ iosLive }),
  };
};
