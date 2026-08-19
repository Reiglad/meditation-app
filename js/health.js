// health.js
// 日々の心身の振り返り（睡眠の質・気分・ストレス・エネルギー・集中力・運動・メモ）を
// localStorageに記録するデータ層。storage.js（瞑想・NSDRのセッション記録）とは
// 別のキーで管理する。1日1件（その日の最新の回答で上書き）が基本。
//
// 評価はすべて 1〜5 の5段階で統一し、「5が良い状態」になるようそろえてある
// （ストレスは項目としては逆方向の感覚だが、UI上は「とても穏やか」〜「とても緊張」の
// ラベルにして、5=穏やか（良い状態）になるようにしている）。

const HEALTH_STORAGE_KEY = 'health_checkins_v1';

// 5段階評価の項目定義。すべて「5が良い状態」になるようそろえてある
// （ストレスは項目としては逆方向の感覚のため、ラベルを「とても穏やか」〜「とても緊張」にしている）。
// icons は 1〜5 に対応する絵文字（共通の表情スケールで統一し、直感的にタップで選べるようにする）。
const HEALTH_RATING_ICONS = ['😞', '😕', '😐', '🙂', '😄'];
const HEALTH_METRICS = [
  { key: 'sleepQuality', label: '睡眠の質', icons: HEALTH_RATING_ICONS, color: '#7fc6a4' },
  { key: 'mood', label: '今日の気分', icons: HEALTH_RATING_ICONS, color: '#f3c9d4' },
  {
    key: 'stress',
    label: 'ストレス',
    // 1=とても緊張 → 5=とても穏やか、の順で「5が良い状態」に統一
    icons: ['😣', '😟', '😐', '🙂', '😌'],
    color: '#bcd8ee',
  },
  { key: 'energy', label: 'エネルギー', icons: HEALTH_RATING_ICONS, color: '#f0b26b' },
  { key: 'focus', label: '集中力', icons: HEALTH_RATING_ICONS, color: '#a8dcc2' },
];

// 運動の有無・強度（4択）
const EXERCISE_OPTIONS = [
  { id: 'none', label: 'なし', icon: '🛌' },
  { id: 'light', label: '軽め', icon: '🚶' },
  { id: 'moderate', label: '普通', icon: '🚴' },
  { id: 'intense', label: 'しっかり', icon: '🏋️' },
];

/**
 * 全チェックイン記録を取得する（日付昇順ではなく保存順）
 * @returns {Array<Object>}
 */
function getCheckins() {
  try {
    const raw = localStorage.getItem(HEALTH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error('健康記録の読み込みに失敗しました', e);
    return [];
  }
}

function saveCheckins(checkins) {
  try {
    localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(checkins));
  } catch (e) {
    console.error('健康記録の保存に失敗しました', e);
  }
}

/**
 * 指定日の記録を取得する（なければnull）
 * @param {string} date - YYYY-MM-DD
 */
function getCheckinByDate(date) {
  return getCheckins().find((c) => c.date === date) || null;
}

/**
 * 今日の記録を取得する（なければnull）
 */
function getTodayCheckin() {
  return getCheckinByDate(formatDateLocal(new Date()));
}

/**
 * 今日すでに記録済みかどうか
 */
function hasTodayCheckin() {
  return getTodayCheckin() !== null;
}

/**
 * チェックインを保存する。同じ日付の記録が既にあれば上書き、なければ新規追加する。
 * @param {Object} data - { date, sleepQuality, mood, stress, energy, focus, exercise, memo }
 *   date省略時は今日の日付。各評価項目（sleepQuality/mood/stress/energy/focus）は1〜5の整数、
 *   未回答の項目はnull可。exerciseは 'none' | 'light' | 'moderate' | 'intense'。memoは文字列。
 * @returns {Object} 保存された記録
 */
function upsertCheckin(data) {
  const checkins = getCheckins();
  const date = data.date || formatDateLocal(new Date());
  const now = new Date().toISOString();
  const existingIndex = checkins.findIndex((c) => c.date === date);

  const record = {
    id: existingIndex >= 0 ? checkins[existingIndex].id : generateId(),
    date,
    sleepQuality: data.sleepQuality ?? null,
    mood: data.mood ?? null,
    stress: data.stress ?? null,
    energy: data.energy ?? null,
    focus: data.focus ?? null,
    exercise: data.exercise ?? null,
    memo: data.memo || '',
    createdAt: existingIndex >= 0 ? checkins[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    checkins[existingIndex] = record;
  } else {
    checkins.push(record);
  }
  saveCheckins(checkins);
  return record;
}

/**
 * チェックインを1件削除する
 * @param {string} id
 */
function deleteCheckin(id) {
  const checkins = getCheckins().filter((c) => c.id !== id);
  saveCheckins(checkins);
}

/**
 * 直近N日分の記録を、日付昇順（古い→新しい）で返す。記録が無い日は含まれない
 * （グラフ描画側で日付の間隔から欠損を扱う）。
 * @param {number} days
 */
function getRecentCheckins(days) {
  const checkins = getCheckins();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);
  return checkins
    .filter((c) => new Date(`${c.date}T00:00:00`) >= cutoff)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * 夜（18時以降）かどうかを判定する。ホーム画面での振り返りバナー表示条件に使う。
 */
function isEveningNow() {
  return new Date().getHours() >= 18;
}
