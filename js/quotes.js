// quotes.js
// ホーム画面に表示する「自分を大切にする」ための短い言葉集（英語）。
// 特定の著作物からの引用ではなく、このアプリのために書き下ろしたオリジナルの言葉。
// アプリを開く（ホーム画面を表示する）たびに、ランダムに1つ選んで表示する。

const SELF_CARE_QUOTES = [
  "You don't have to try so hard. Today, as you are, is enough.",
  "Rest isn't laziness. It's how you prepare for what's next.",
  "Being kind to yourself isn't selfish.",
  "You don't need to be perfect. Simply getting through today is an achievement.",
  "It's okay to pause when you're tired. Your worth doesn't change.",
  "No need to compare yourself to others. Go at your own pace.",
  "Even a small step is still progress.",
  "Trade a little of your self-blame for self-care.",
  "Give yourself credit for what you managed today.",
  "Just breathing deeply can lighten your heart.",
  "Choosing not to push yourself is a valid choice too.",
  "It's okay to put yourself first sometimes.",
  "Some days won't go well. That's part of who you are too.",
  "Quiet moments matter too.",
  "No need to rush. Your pace is enough.",
  "Tell yourself, 'You did well today.'",
  "Rest is recovery, not laziness.",
  "Listen to your own feelings first.",
  "Focus on what you did, not what you couldn't.",
  "When your heart is tired, resting is the right answer.",
  "Be yourself, at your own pace.",
  "You made it through another day.",
  "You don't have to force a smile. Honest feelings are enough.",
  "Comfort yourself before you criticize yourself.",
  "Be someone who notices life's small joys.",
];

/**
 * 「自分を大切にする」ための言葉をランダムに1つ返す
 * @returns {string}
 */
function getRandomQuote() {
  const index = Math.floor(Math.random() * SELF_CARE_QUOTES.length);
  return SELF_CARE_QUOTES[index];
}
