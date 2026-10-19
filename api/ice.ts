/**
 * Vercel Function: GET /api/ice → { iceServers: RTCIceServer[] } for the online co-op WebRTC link.
 *
 * STUN (free, always included) lets most players connect directly. Some mobile carriers / office
 * networks block direct links; a TURN relay fixes that. Configure ONE provider in
 * Vercel → Project → Settings → Environment Variables:
 *
 *   Cloudflare Realtime TURN:                         CF_TURN_KEY_ID + CF_TURN_API_TOKEN
 *   Metered.ca (free tier):                          METERED_APP + METERED_API_KEY   (METERED_APP = "yourapp" of yourapp.metered.live)
 *   Any TURN server with static credentials:         TURN_URLS (comma separated) + TURN_USERNAME + TURN_CREDENTIAL
 *
 * Secrets stay on the server; the browser only receives short-lived credentials.
 */

declare const process: { env: Record<string, string | undefined> };

type Ice = { urls: string | string[]; username?: string; credential?: string };

const STUN: Ice[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    // the Android app (https://localhost) also asks for this list
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

async function cloudflare(keyId: string, token: string): Promise<Ice[]> {
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 6 * 3600 }),
  });
  if (!r.ok) throw new Error(`cloudflare ${r.status}`);
  const j = (await r.json()) as { iceServers: Ice[] | Ice };
  const list = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
  // browsers block port 53 → drop those URLs to avoid slow ICE gathering
  return list.map((s) => ({ ...s, urls: ([] as string[]).concat(s.urls).filter((u) => !u.includes(':53')) }));
}

async function metered(app: string, key: string): Promise<Ice[]> {
  const r = await fetch(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error(`metered ${r.status}`);
  return (await r.json()) as Ice[];
}

export async function GET(): Promise<Response> {
  const env = process.env;
  try {
    if (env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN) return json({ iceServers: [...STUN, ...(await cloudflare(env.CF_TURN_KEY_ID, env.CF_TURN_API_TOKEN))] });
    if (env.METERED_APP && env.METERED_API_KEY) return json({ iceServers: [...STUN, ...(await metered(env.METERED_APP, env.METERED_API_KEY))] });
    if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      return json({ iceServers: [...STUN, { urls: env.TURN_URLS.split(',').map((s) => s.trim()), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }] });
    }
  } catch (e) {
    console.error('[ice] TURN provider failed, STUN only', e);
  }
  return json({ iceServers: STUN });
}
