// src/index.js
// 瞑想記録アプリのリマインダー通知（Web Push）を担当するCloudflare Worker。
//
// fetch    : フロントエンドからのAPI呼び出し（Subscription登録・リマインダーCRUD）を処理する。
// scheduled: 1分毎に起動し、現在時刻と一致する有効なリマインダーがあればPush通知を送信する。
//
// MVP段階では単一ユーザー・単一デバイス・単一リマインダーのみを想定し、
// KVのキーは固定（subscription:default / reminder:default）で運用する。
// 複数リマインダー対応時は `reminder:<uuid>` + インデックスキーへ移行する。

import { buildPushPayload } from '@block65/webcrypto-web-push';

const ALLOWED_ORIGIN = 'https://reiglad.github.io';

const SUBSCRIPTION_KEY = 'subscription:default';
const REMINDER_KEY = 'reminder:default';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

/**
 * 簡易保護トークンによる認可チェック。
 * 注意：APP_SECRETはPublicリポジトリのフロントエンドコードに平文で埋め込まれるため、
 * 真の認証ではなく「野良アクセスの抑止」程度である（CLAUDE.md参照）。
 */
function isAuthorized(request, env) {
  return request.headers.get('X-App-Secret') === env.APP_SECRET;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (!isAuthorized(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (url.pathname === '/api/subscribe' && request.method === 'DELETE') {
      await env.REMINDERS_KV.delete(SUBSCRIPTION_KEY);
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/reminder' && request.method === 'GET') {
      const raw = await env.REMINDERS_KV.get(REMINDER_KEY);
      return jsonResponse(raw ? JSON.parse(raw) : null);
    }

    if (url.pathname === '/api/reminder' && request.method === 'PUT') {
      return handleReminderPut(request, env);
    }

    return jsonResponse({ error: 'not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAndSend(env));
  },
};

/** POST /api/subscribe: Push Subscriptionを登録（新規/上書き）する */
async function handleSubscribe(request, env) {
  let subscription;
  try {
    subscription = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400);
  }

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return jsonResponse({ error: 'invalid subscription' }, 400);
  }

  const record = { ...subscription, registeredAt: new Date().toISOString() };
  await env.REMINDERS_KV.put(SUBSCRIPTION_KEY, JSON.stringify(record));
  return jsonResponse({ ok: true });
}

/** PUT /api/reminder: リマインダーを作成・更新する */
async function handleReminderPut(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400);
  }

  if (!body || typeof body.title !== 'string' || typeof body.time !== 'string') {
    return jsonResponse({ error: 'title and time are required' }, 400);
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) {
    return jsonResponse({ error: 'time must be in HH:MM (24h) format' }, 400);
  }

  const record = {
    id: 'default',
    title: body.title,
    time: body.time,
    enabled: body.enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  await env.REMINDERS_KV.put(REMINDER_KEY, JSON.stringify(record));
  return jsonResponse(record);
}

/**
 * 現在時刻（Asia/Tokyo基準）が有効なリマインダーの時刻と一致していれば、
 * 登録済みのSubscriptionにPush通知を送信する。
 */
async function checkAndSend(env) {
  const { date, time } = getJstDateAndTime(new Date());

  const reminderRaw = await env.REMINDERS_KV.get(REMINDER_KEY);
  if (!reminderRaw) return;
  const reminder = JSON.parse(reminderRaw);
  if (!reminder.enabled || reminder.time !== time) return;

  // 同一分内の重複送信防止（Cronの多重起動・遅延実行対策）
  const sentKey = `sent:${date}:default`;
  const alreadySent = await env.REMINDERS_KV.get(sentKey);
  if (alreadySent) return;

  const subscriptionRaw = await env.REMINDERS_KV.get(SUBSCRIPTION_KEY);
  if (!subscriptionRaw) return;
  const subscription = JSON.parse(subscriptionRaw);

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const message = {
    data: JSON.stringify({
      title: reminder.title,
      body: 'タップしてアプリを開きましょう',
    }),
    options: { ttl: 60 },
  };

  try {
    const payload = await buildPushPayload(message, subscription, vapid);
    const res = await fetch(subscription.endpoint, payload);

    if (res.status === 404 || res.status === 410) {
      // Subscriptionが失効している（ユーザーが通知を無効化した等）ので削除する
      await env.REMINDERS_KV.delete(SUBSCRIPTION_KEY);
      return;
    }
    await env.REMINDERS_KV.put(sentKey, '1', { expirationTtl: 120 });
  } catch (err) {
    console.error('push送信に失敗しました', err);
  }
}

/**
 * Asia/Tokyo基準の日付(YYYY-MM-DD)と時刻(HH:MM, 24時間制)を取得する
 */
function getJstDateAndTime(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}
