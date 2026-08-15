// stats.js
// セッション記録から統計情報（連続日数・週間合計・月間合計）を算出する。

/**
 * YYYY-MM-DD文字列をローカル日付として Date オブジェクトに変換する
 * （new Date('YYYY-MM-DD')はUTC解釈されタイムゾーンによりズレるため使わない）
 */
function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 連続日数（ストリーク）を計算する。
 * 「瞑想 or NSDR のいずれかを実施した日」を1日としてカウントし、
 * 今日 or 昨日を起点に、記録が途切れるまでの連続日数を返す。
 * @param {Array<Object>} sessions
 * @returns {number}
 */
function calcStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;

  // 実施日のユニーク集合を作る
  const dateSet = new Set(sessions.map((s) => s.date));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 今日実施していなければ、昨日を起点として数える（今日はまだこれから、という状態を許容）
  let cursor = new Date(today);
  const todayStr = formatDateLocalForStats(today);
  if (!dateSet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dateSet.has(formatDateLocalForStats(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * 今週（月曜始まり）の合計実施時間（秒）を計算する
 * @param {Array<Object>} sessions
 * @returns {number}
 */
function calcWeeklyTotal(sessions) {
  const now = new Date();
  const start = getWeekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return sumDurationInRange(sessions, start, end);
}

/**
 * 今月の合計実施時間（秒）を計算する
 * @param {Array<Object>} sessions
 * @returns {number}
 */
function calcMonthlyTotal(sessions) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return sumDurationInRange(sessions, start, end);
}

/**
 * 指定期間 [start, end) に含まれるセッションの合計時間（秒）
 */
function sumDurationInRange(sessions, start, end) {
  return sessions
    .filter((s) => {
      const d = parseDateLocal(s.date);
      return d >= start && d < end;
    })
    .reduce((sum, s) => sum + (s.durationSec || 0), 0);
}

/**
 * その週（月曜始まり）の開始日を返す
 */
function getWeekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0:日 1:月 ... 6:土
  const diff = (day === 0 ? -6 : 1) - day; // 月曜日までの差分
  d.setDate(d.getDate() + diff);
  return d;
}

// 注意：storage.js にも同名の日付フォーマット関数があるが、
// グローバルスコープでの名前衝突を避けるためこちらは別名にしている。
function formatDateLocalForStats(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 秒数を "H時間M分" or "M分" 形式の文字列に変換する
 * @param {number} sec
 * @returns {string}
 */
function formatDuration(sec) {
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}
