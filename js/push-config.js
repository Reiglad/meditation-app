// push-config.js
// Web Push通知（Cloudflare Worker側との連携）に関する設定値。
//
// 注意：
//   - APP_SECRETはPublicリポジトリのこのファイルに平文で入るため、
//     真の認証ではなく「野良アクセスの抑止」程度でしかない（CLAUDE.md参照）。
//   - VAPID鍵ペアを再発行した場合は、VAPID_PUBLIC_KEY をここも合わせて更新すること。
//     再発行すると既存のPush Subscriptionは無効になるため、再度「通知を有効にする」を
//     押してもらう必要がある。

const PUSH_CONFIG = {
  // Cloudflare WorkerのベースURL（worker/wrangler.toml の name から自動生成される workers.dev ドメイン）
  WORKER_BASE_URL: 'https://meditation-app-worker.rei-ina34171730.workers.dev',

  // VAPID公開鍵（`npx web-push generate-vapid-keys` で生成したもの。秘密鍵はWorker側のシークレットにのみ保存する）
  VAPID_PUBLIC_KEY: 'BAYybnW9rDqTok0_IAmfxIRhSZy_76QbSNGfnA4JEnB6GrfXoh9uyl5HKliYdzzQIgfs80aqdLvp2fH2U8web-0',

  // Worker APIの簡易保護トークン（worker側の APP_SECRET シークレットと一致させる）
  APP_SECRET: 'NbSx1lihYkUw4QJI1JpSd19WfUNimTn4',
};
