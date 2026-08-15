// backgrounds.js
// アプリ起動のたびにランダムで切り替える、自然写真の背景画像リスト。
// 画像本体は images/nature/ に同梱している（Unsplashの無料ライセンス、商用利用可・クレジット表記不要）。

const NATURE_BACKGROUNDS = [
  'images/nature/waterfall-1.webp',
  'images/nature/waterfall-2.webp',
  'images/nature/river-1.webp',
  'images/nature/river-2.webp',
  'images/nature/forest-1.webp',
  'images/nature/forest-2.webp',
  'images/nature/jungle-1.webp',
  'images/nature/jungle-2.webp',
  'images/nature/ocean-1.webp',
  'images/nature/ocean-2.webp',
  'images/nature/mountain-1.webp',
  'images/nature/lake-1.webp',
  'images/nature/starry-sky-1.webp',
  'images/nature/snow-mountain-1.webp',
  'images/nature/cherry-blossom-1.webp',
];

/**
 * 背景画像のパスをランダムに1つ返す
 * @returns {string}
 */
function getRandomBackground() {
  const index = Math.floor(Math.random() * NATURE_BACKGROUNDS.length);
  return NATURE_BACKGROUNDS[index];
}
