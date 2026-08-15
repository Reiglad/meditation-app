// push.js
// Web Push通知の購読・解除を担当する。Cloudflare Worker側（worker/src/index.js）と
// push-config.js の設定値を介して連携する。
//
// iOS Safariの制約：Web Push（Notification API / Push API）は、
// iOS 16.4以降かつホーム画面に追加してPWAとして起動している場合（standalone表示）のみ利用できる。
// Safari単体のブラウザタブでは使用できないため、isPushSupported() でその前提を確認する。

/**
 * ホーム画面に追加したPWA（standalone表示）として起動しているかどうか
 * @returns {boolean}
 */
function isStandalone() {
  return (
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );
}

/**
 * この端末・ブラウザでWeb Push通知が利用可能かどうか
 * @returns {boolean}
 */
function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    isStandalone()
  );
}

/**
 * VAPID公開鍵（base64url文字列）をPushManager.subscribeに渡せるUint8Arrayに変換する
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Worker APIを共通ヘッダー付きで呼び出す
 * @param {string} path - 例: '/api/subscribe'
 * @param {Object} options - fetchのoptions（method, body等）
 */
function callWorkerApi(path, options = {}) {
  return fetch(PUSH_CONFIG.WORKER_BASE_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Secret': PUSH_CONFIG.APP_SECRET,
      ...(options.headers || {}),
    },
  });
}

/**
 * 通知許可を要求し、Push Subscriptionを作成してWorkerに登録する
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function subscribeToPush() {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.VAPID_PUBLIC_KEY),
    });
  }

  const res = await callWorkerApi('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    return { ok: false, reason: 'server-error' };
  }
  return { ok: true };
}

/**
 * Push購読を解除する（端末側の購読解除＋Worker側のSubscription削除）
 */
async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  await callWorkerApi('/api/subscribe', { method: 'DELETE' });
}

/**
 * 現在この端末でPush購読済みかどうか
 * @returns {Promise<boolean>}
 */
async function isSubscribedToPush() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}
