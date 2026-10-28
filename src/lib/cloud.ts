/**
 * WorkBuddy 云服务客户端（单例）。
 *
 * 云服务开通后由 workbuddy_cloud_service 下发 publicConfig，这里把「面向应用前端」
 * 的公开配置写入客户端，四个模块（数据库 / 认证 / 存储 / LLM）共用这一个实例：
 *
 *   - endpoint：本应用发布域名的数据面基址（承载 /.cloud/**）
 *   - oauthRelayBaseUrl：中心 OAuth Relay 基址（网页第三方登录用）
 *   - publishableKey：仅标识「哪个应用」，不携带权限；安全由服务端 Origin 精确匹配保证
 *
 * 以上三项都是可安全打进前端产物的公开值；底层环境 id 与各类密钥都在服务端，绝不出现在前端。
 */
import { createWorkBuddyCloud } from "@tencent-ai/workbuddy-cloud-sdk";

const publicConfig = {
  endpoint: "https://comprehensive-renovation.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey: "wbpk_1Iqy5CnctJvGYAtzbxKmvE_nNK4bOzIgRbTxNwaVlsSfOpnWgNK9DeE",
};

export const cloud = createWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
});
