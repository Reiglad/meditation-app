// storage.js
// localStorage を用いたセッション記録の読み書きを担当するデータ層。
// 将来クラウド同期（Firebase等）へ差し替えやすいよう、
// 呼び出し側は本ファイルが公開する関数のみを利用する想定とする。

const STORAGE_KEY = 'meditation_sessions_v1';

/**
 * UUIDを生成する（crypto.randomUUIDが使えない環境向けのフォールバック付き）
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // フォールバック：簡易UUID v4相当
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 全セッション記録を取得する
 * @returns {Array<Object>} セッション記録の配列（新しい順ではなく保存順）
 */
function getSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error('セッション記録の読み込みに失敗しました', e);
    return [];
  }
}

/**
 * セッション記録を1件追加する
 * @param {Object} session - { date, type, durationSec, youtubeVideoId }
 * @returns {Object} 保存された完全なセッションレコード（id, createdAt付与済み）
 */
function addSession(session) {
  const sessions = getSessions();

  const now = new Date();
  const record = {
    id: generateId(),
    date: session.date || formatDateLocal(now),
    type: session.type,
    durationSec: session.durationSec,
    youtubeVideoId: session.youtubeVideoId || '',
    createdAt: now.toISOString(),
  };

  sessions.push(record);
  saveSessions(sessions);
  return record;
}

/**
 * セッション記録を1件削除する
 * @param {string} id
 */
function deleteSession(id) {
  const sessions = getSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
}

/**
 * 全セッション記録を上書き保存する（内部利用想定だが将来の同期処理向けに公開）
 * @param {Array<Object>} sessions
 */
function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('セッション記録の保存に失敗しました', e);
  }
}

/**
 * ローカルタイムゾーンで YYYY-MM-DD 形式の日付文字列を生成する
 * @param {Date} d
 * @returns {string}
 */
function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
