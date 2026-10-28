# 户型图智能分析与三维可视化系统（floorplan-studio）

根据户型图识别成三维模型，并进一步生成各类风格的装修效果图。

将标准户型图（图片 / PDF）自动解析为结构化户型，生成**尺寸精确**的三维模型，
支持硬装软装多方案设计与全景入户漫游，是面向室内设计前期的全流程工具。

## 功能总览

| 步骤 | 模块 | 能力 |
|---|---|---|
| ① | 户型识别 | 上传/下载标准户型图，页面分流（户型图/营销页）、尺寸链标定、墙体门窗房间提取，人工确认队列 |
| ② | 三维建模 | 从识别结果程序化生成精确 3D 模型（墙体 Extrude + CSG 门窗开洞），尺寸与结构比例准确 |
| ③ | 方案设计 | 16 套风格模板，硬装软装（地面/墙面/家具/照明/材质/颜色）参数化，多方案 A/B 同屏对比 |
| ④ | 全景漫游 | 入户门起自动规划行走路径，CubeCamera 渲染 2:1 全景，热点导航 + 小地图 + 自动导览 |
| ⑤ | 分享与配套 | 客户只读分享链接（访问码保护）、工程量与预算、AI 变更提案、CSV/JSON 导出 |

## 技术栈

- **前端**：Next.js 14（App Router）+ React 18 + TypeScript strict + Tailwind CSS v4
- **三维/全景**：Three.js + @react-three/fiber + @react-three/drei；three-bvh-csg（门窗开洞）；@photo-sphere-viewer/core（全景查看）
- **识别**：sharp（图像）、pdfjs-dist（PDF 栅格化）、自研 CV 管线（尺寸链/颜色分层/距离场房间分割）
- **AI**：OpenAI 兼容协议（官方 / 国内厂商可切），无 Key 时全链路本地可跑
- **数据**：Prisma 6 + SQLite

## 环境要求

- Node.js ≥ 20（推荐 22，原生支持 TypeScript 类型剥离，可直接运行 `.ts` 脚本）
- npm ≥ 9
- Windows / macOS / Linux 均可（本地运行，无公网依赖）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制示例，按需填写 AI 密钥）
cp .env.example .env
#   - 无 AI 密钥也能运行（识别走本地 CV + 人工确认，贴图/提案降级）

# 3. 初始化数据库（生成 Prisma Client + 建表 + 写入内置风格/材质种子数据）
npx prisma generate
npx prisma db push
npm run seed

# 4. 启动开发服务器
npm run dev
#   打开 http://localhost:3000
```

## `.env` 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | SQLite 路径，默认 `file:./data/app.db` |
| `AI_PROVIDER` | 否 | `openai`（默认）或 `custom`，决定优先用哪家 |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` | 否 | OpenAI 官方接口；填 Key 后自动启用视觉识别与材质增强 |
| `OPENAI_VISION_MODEL` / `OPENAI_IMAGE_MODEL` | 否 | 默认 `gpt-4o` / `gpt-image-1` |
| `CUSTOM_BASE_URL` / `CUSTOM_API_KEY` 等 | 否 | 国内厂商（OpenAI 兼容协议：通义千问 VL / 智谱 GLM-4V / 豆包等） |
| `CLIENT_ACCESS_SECRET` | 否* | 客户分享链接的 HMAC 签名密钥；*使用「分享链接 + 访问码」功能前必须设置 |

> 未配置任何 AI 密钥时，系统仍可完整跑通四个模块：识别走「300mm 模数搜索 + 规则分类 + 人工确认」，
> 材质走程序化纯色/贴图，AI 变更提案入口会明确提示不可用。

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建（含 prisma generate）
npm run start        # 生产启动
npm run typecheck    # TypeScript 类型检查
npm run test         # 回归测试（解析→建模→路径）
npm run prisma:push  # 推送 schema 到数据库
npm run seed         # 写入种子数据
npm run db:reset     # 重置数据库并重新 seed
```

## 目录结构

```
src/
├─ lib/
│  ├─ cv/            # 计算机视觉：预处理/颜色分层/尺寸链/房间分割
│  ├─ geom/          # 几何：轮廓矢量化/墙体
│  ├─ parse/         # 识别编排 + VLM
│  ├─ model3d/       # 三维构建（Extrude + CSG）
│  ├─ pano/          # 路径规划 + 全景捕获
│  ├─ ai/            # AI Provider 抽象（vision/image/chat）
│  ├─ quantity.ts    # 工程量计算
│  ├─ budget.ts      # 预算
│  ├─ styles.ts      # 16 套风格模板
│  ├─ materials.ts   # 材质库（规格/价格/贴图）
│  └─ client-access.ts # 客户分享安全机制
├─ components/       # UI 组件（布局/模型/漫游）
└─ app/
   ├─ projects/[id]/ # 项目工作流：parse/model/design/tour/manage
   ├─ share/[token]/ # 客户只读分享页
   └─ api/           # Route Handlers
```

## 坐标系约定（二次开发必读）

- 图纸坐标：**毫米**，原点左上，x 右、y 下
- 三维坐标：**米**，x 右、y 上、z 向观察者（`X=x/1000, Z=y/1000`）
- 全景图：等距圆柱 2:1，经度 `lon=0` 对应 `+z` 轴；热点 yaw = `atan2(dx, dz)`

## 说明与边界

- 效果图与全景均由三维场景程序化渲染，**与几何同源**，尺寸可信；非 AI 生图。
- 系统产出为设计建议与意向效果，不构成施工图或合同报价；涉及结构/消防等以专业机构为准。
