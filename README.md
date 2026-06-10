# 直播竞拍系统 (Live Auction)

基于 Node.js + React + WebSocket 构建的实时直播竞拍系统，支持高并发场景下的实时价格更新和排行榜展示。

## 📋 项目简介

本系统是一个完整的直播竞拍平台，包含以下核心功能：

- **实时竞拍**：用户可以实时出价，价格即时更新
- **WebSocket 广播**：后端实时推送价格变化和排行榜数据
- **Redis 排行榜**：基于 ZSET 实现高性能排行榜
- **模拟支付**：支持模拟订单支付和超时流拍机制
- **管理后台**：商品管理、订单管理、控制台监控

## 🛠️ 技术栈

### 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | 20+ | 运行时环境 |
| Express | 4.x | Web 框架 |
| MySQL | 8.0 | 持久化存储 |
| Redis | 7.x | 缓存和排行榜 |
| WebSocket | - | 实时通信 |
| Artillery | - | 性能压测 |

### 前端客户端 (H5)
| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 6.x | 类型安全 |
| Vite | 8.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |
| lucide-react | 1.x | 图标库 |

### 前端管理端
| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 6.x | 类型安全 |
| Vite | 8.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |

## 📁 目录结构

```
live-auction/                           # 项目根目录
├── backend/                            # 后端服务
│   ├── database/                       # 数据库初始化
│   │   └── schema.sql                  # MySQL 建表脚本
│   ├── src/
│   │   ├── config/                     # 配置文件
│   │   │   ├── env.js                  # 环境变量
│   │   │   ├── mysql.js                # MySQL 配置
│   │   │   ├── redis.js                # Redis 配置
│   │   │   └── websocket.js            # WebSocket 配置
│   │   ├── engines/                    # 核心引擎
│   │   │   ├── auction-engine.js       # 竞拍引擎
│   │   │   └── settlement-engine.js    # 结算引擎
│   │   ├── infrastructure/             # 基础设施
│   │   │   ├── db.js                   # 数据库连接
│   │   │   ├── redis.js                # Redis 客户端
│   │   │   └── wss.js                  # WebSocket 服务
│   │   ├── modules/                    # 业务模块
│   │   │   ├── auction/                # 竞拍模块
│   │   │   │   ├── auction-event-handler.js  # 事件处理器
│   │   │   │   ├── auction.controller.js      # 控制器
│   │   │   │   ├── auction.service.js        # 服务层
│   │   │   │   ├── auction.mysql.repository.js  # MySQL 仓储
│   │   │   │   ├── auction.redis.repository.js  # Redis 仓储
│   │   │   │   └── auction.routes.js         # 路由
│   │   │   ├── order/                  # 订单模块
│   │   │   │   ├── order.controller.js
│   │   │   │   ├── order.service.js
│   │   │   │   ├── order.repository.js
│   │   │   │   └── order.routes.js
│   │   │   └── room/                   # 房间模块
│   │   │       ├── room.controller.js
│   │   │       ├── room.service.js
│   │   │       └── room.routes.js
│   │   ├── scheduler/                  # 定时任务
│   │   │   └── auction-scheduler.js    # 竞拍定时清算
│   │   ├── utils/                      # 工具函数
│   │   │   ├── logger.js               # 日志工具
│   │   │   ├── money.js                # 金额处理
│   │   │   └── time.js                 # 时间处理
│   │   ├── app.js                      # Express 应用
│   │   └── server.js                   # 服务器入口
│   ├── .env.example                    # 环境变量模板
│   ├── Dockerfile                      # Docker 配置
│   └── package.json
├── frontend-client/                    # 用户端 H5
│   ├── src/
│   │   ├── app/                        # 应用入口
│   │   ├── features/                   # 业务特性
│   │   │   └── auction/                # 竞拍相关
│   │   │       ├── components/         # UI 组件
│   │   │       │   ├── AuctionCard.tsx     # 竞拍卡片
│   │   │       │   ├── PricePanel.tsx      # 价格面板
│   │   │       │   ├── BidPanel.tsx        # 出价面板
│   │   │       │   ├── Payment.tsx         # 支付组件
│   │   │       │   └── LeaderboardDrawer.tsx  # 排行榜
│   │   │       ├── hooks/              # 自定义 Hooks
│   │   │       │   ├── useAuctionSocket.ts # WebSocket Hook
│   │   │       │   └── useAuctionstore.ts  # 状态管理 Hook
│   │   │       ├── store/              # 全局状态
│   │   │       │   └── auction.store.tsx   # 竞拍状态管理
│   │   │       ├── services/           # API 服务
│   │   │       │   └── auction.api.ts      # 竞拍 API
│   │   │       └── types/              # TypeScript 类型
│   │   ├── page/                       # 页面
│   │   │   └── AuctionPage.tsx         # 竞拍主页面
│   │   └── shared/                     # 共享工具
│   │       └── utils/                  # 工具函数
│   └── package.json
├── frontend-admin/                     # 管理后台
│   ├── src/
│   │   ├── features/                   # 业务特性
│   │   │   ├── auction/                # 竞拍管理
│   │   │   │   ├── pages/
│   │   │   │   │   ├── AuctionConsolePage.tsx  # 控制台
│   │   │   │   │   ├── AuctionCreatePage.tsx   # 新建商品
│   │   │   │   │   └── AuctionListPage.tsx     # 商品列表
│   │   │   │   └── store/
│   │   │   │       └── console.store.tsx       # 控制台状态
│   │   │   └── order/                  # 订单管理
│   │   │       └── pages/
│   │   │           └── OrderListPage.tsx       # 订单列表
│   │   ├── layouts/                    # 布局组件
│   │   └── router/                     # 路由配置
│   └── package.json
├── stress-tests/                       # 性能压测
│   ├── ws-connect.yml                  # WebSocket 连接压测
│   └── bid.yml                         # 出价并发压测
├── docker-compose.yml                  # Docker Compose 配置
└── README.md                           # 项目说明
```

## 🚀 快速开始

### 环境要求

- Node.js >= 20.x
- MySQL >= 8.0
- Redis >= 7.x
- npm 或 yarn

### 本地开发

#### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装用户端依赖
cd ../frontend-client
npm install

# 安装管理端依赖
cd ../frontend-admin
npm install
```

#### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env` 并配置：

```env
# 服务器配置
PORT=3000
HOST=118.196.28.152

# MySQL 配置
DB_HOST=118.196.28.152
DB_PORT=3306
DB_NAME=auction
DB_USER=root
DB_PASSWORD=your_password

# Redis 配置
REDIS_HOST=118.196.28.152
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 密钥
JWT_SECRET=your_jwt_secret
```

#### 3. 初始化数据库

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS auction;"

# 导入 schema
mysql -u root -p auction < backend/database/schema.sql
```

#### 4. 启动服务

```bash
# 启动后端 (终端1)
cd backend
npm run dev

# 启动用户端 (终端2)
cd frontend-client
npm run dev

# 启动管理端 (终端3)
cd frontend-admin
npm run dev
```

### Docker 部署

#### 启动服务

```bash
# 启动所有服务（MySQL, Redis, Backend）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### Docker 环境变量说明

Docker 环境下无需修改 `.env`，`docker-compose.yml` 已配置：

- MySQL Host: `mysql`
- Redis Host: `redis`
- Backend Port: `3000`

## 🔧 配置说明

### 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 后端 API | 3000 | REST API 和 WebSocket |
| 用户端 | 5173 | H5 前端 |
| 管理端 | 5174 | 管理后台 |
| MySQL | 3306 | 数据库 |
| Redis | 6379 | 缓存 |

### WebSocket 连接

前端通过以下地址连接 WebSocket：

```
ws://118.196.28.152:3000/?roomId={roomId}
```

### 事件类型

后端广播的 WebSocket 事件：

| 事件类型 | 说明 |
|----------|------|
| `price_update` | 价格更新 |
| `room_display` | 房间状态更新 |
| `leaderboard_update` | 排行榜更新 |
| `AUCTION_PAID` | 支付成功 |
| `AUCTION_PAYMENT_TIMEOUT` | 支付超时 |

## 🧪 性能压测

### 安装 Artillery

```bash
npm install -g artillery
```

### 运行压测

```bash
# 模拟 1000 人在线观战
artillery run stress-tests/ws-connect.yml

# 模拟 50 人高频出价
artillery run stress-tests/bid.yml
```

## 📡 API 接口

### 竞拍接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auction/:id` | 获取拍品详情 |
| POST | `/api/auction/bid` | 出价 |
| GET | `/api/auction/:id/leaderboard` | 获取排行榜 |

### 订单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/order/pay` | 支付订单 |
| GET | `/api/order/:id` | 获取订单详情 |

### 房间接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/room/:id` | 获取房间信息 |
| POST | `/api/room/:id/start` | 开始竞拍 |

## 📊 数据结构

### 竞拍商品 (Auction)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 商品 ID |
| name | string | 商品名称 |
| start_price | int | 起拍价 |
| current_price | int | 当前价 |
| max_price | int | 封顶价 |
| bid_increment | int | 加价幅度 |
| status | string | 状态 |
| scheduled_end_time | datetime | 结束时间 |

### 订单 (Order)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 订单 ID |
| auction_id | int | 拍品 ID |
| user_id | int | 用户 ID |
| bid_price | int | 出价金额 |
| status | string | 订单状态 |

### Redis ZSET 排行榜

```
Key: auction:leaderboard:{auctionId}
Score: 出价金额 (bidPrice)
Member: 用户 ID (userId)
```

## 🎨 前端组件说明

### 用户端组件

| 组件 | 说明 |
|------|------|
| AuctionCard | 竞拍卡片主组件 |
| PricePanel | 价格展示面板 |
| BidPanel | 出价操作面板 |
| Payment | 模拟支付组件 |
| LeaderboardDrawer | 排行榜抽屉 |

### 管理端页面

| 页面 | 说明 |
|------|------|
| AuctionConsolePage | 实时控制台 |
| AuctionCreatePage | 新建商品 |
| AuctionListPage | 商品列表 |
| OrderListPage | 订单列表 |

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交代码 (`git commit -m 'feat: xxx'`)
4. 推送到分支 (`git push origin feature/xxx`)
5. 创建 Pull Request

