import { Module } from "@nestjs/common";

/**
 * 异步任务占位（导出、文件处理、后续长任务等）。
 * V1.1 接入 BullMQ + Redis 队列后，在此注册 Processor。
 *
 * 依赖（待接入时安装）：
 * - bullmq
 * - @nestjs/bullmq
 */
@Module({})
export class JobsModule {}
