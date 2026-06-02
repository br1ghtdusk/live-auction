-- =============================================
-- 抖音直播高并发竞拍系统 (重构优化版)
-- MySQL 8.0 Schema
-- 所有金额单位统一：分（BIGINT）
-- =============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0; 

-- =============================================
-- 1. 竞拍商品表
-- =============================================
CREATE TABLE IF NOT EXISTS `auctions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '竞拍商品ID',
    
    -- 核心：多租户与隔离字段
    `merchant_id` BIGINT UNSIGNED NOT NULL COMMENT '商家/主播ID',
    `room_id` BIGINT UNSIGNED NOT NULL COMMENT '直播间ID',

    `name` VARCHAR(255) NOT NULL COMMENT '商品名称',
    `image_url` VARCHAR(512) DEFAULT NULL COMMENT '商品图片',
    `description` TEXT DEFAULT NULL COMMENT '商品描述',

    -- 金额（全部单位：分）
    `start_price` BIGINT NOT NULL DEFAULT 0 COMMENT '起拍价（分）',
    `current_price` BIGINT NOT NULL DEFAULT 0 COMMENT '当前价格（分）',
    `final_price` BIGINT DEFAULT NULL COMMENT '最终成交价（分）',
    `bid_increment` BIGINT NOT NULL COMMENT '加价幅度（分）',
    `ceiling_price` BIGINT NOT NULL COMMENT '封顶价（分）',

    -- 状态机
    `status` VARCHAR(32) NOT NULL DEFAULT 'WAITING' 
        COMMENT 'WAITING/BIDDING/SOLD/FAILED/CANCELLED',

    -- 时间控制
    `scheduled_start_time` DATETIME NOT NULL COMMENT '计划开始时间',
    `scheduled_end_time` DATETIME NOT NULL COMMENT '计划结束时间',
    `actual_start_time` DATETIME DEFAULT NULL COMMENT '实际开始时间',
    `actual_end_time` DATETIME DEFAULT NULL COMMENT '实际结束时间',

    -- 自动延时
    `auto_extend_seconds` INT NOT NULL DEFAULT 10 COMMENT '自动延时秒数',
    `extend_trigger_seconds` INT NOT NULL DEFAULT 10 COMMENT '触发延时阈值（剩余多少秒内出价）',
    `extend_count` INT NOT NULL DEFAULT 0 COMMENT '已延时次数',
    `max_extend_count` INT NOT NULL DEFAULT 99 COMMENT '最大允许延时次数',

    -- 当前领先人
    `highest_bidder_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '当前最高出价用户ID',

    -- 取消信息
    `cancel_reason` VARCHAR(255) DEFAULT NULL COMMENT '取消原因',

    -- 乐观锁版本号（高并发防重复扣款、防乱序核心）
    `version` BIGINT NOT NULL DEFAULT 0 COMMENT '版本号',

    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    
    -- 为商家后台查询和直播间查询建立联合索引
    INDEX `idx_merchant_room` (`merchant_id`, `room_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_scheduled_start_time` (`scheduled_start_time`),
    INDEX `idx_scheduled_end_time` (`scheduled_end_time`),
    INDEX `idx_highest_bidder_id` (`highest_bidder_id`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='竞拍商品表';


-- =============================================
-- 2. 出价记录流水表 (Append-Only)
-- =============================================
CREATE TABLE IF NOT EXISTS `bid_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '出价记录ID',
    `auction_id` BIGINT UNSIGNED NOT NULL COMMENT '竞拍商品ID',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `bid_amount` BIGINT NOT NULL COMMENT '出价金额（分）',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '出价时间',

    PRIMARY KEY (`id`),
    INDEX `idx_auction_id` (`auction_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_auction_created_at` (`auction_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='出价记录流水表';


-- =============================================
-- 3. 订单表
-- =============================================
CREATE TABLE IF NOT EXISTS `orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID',
    `auction_id` BIGINT UNSIGNED NOT NULL COMMENT '竞拍商品ID',
    
    -- 冗余商家ID，避免查询商家订单时频繁 JOIN auctions 表
    `merchant_id` BIGINT UNSIGNED NOT NULL COMMENT '商家/主播ID',
    
    `winner_id` BIGINT UNSIGNED NOT NULL COMMENT '中拍用户ID',
    `final_price` BIGINT NOT NULL COMMENT '成交价（分）',

    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' 
        COMMENT 'PENDING/PAID/CANCELLED/REFUNDED',

    `paid_at` DATETIME DEFAULT NULL COMMENT '支付时间',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_auction_id` (`auction_id`),
    INDEX `idx_merchant_id` (`merchant_id`),
    INDEX `idx_winner_id` (`winner_id`),
    INDEX `idx_status` (`status`)


) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='竞拍订单表';

SET FOREIGN_KEY_CHECKS = 1;