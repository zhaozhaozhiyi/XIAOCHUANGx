import { Module } from "@nestjs/common";

/**
 * 异步任务（会议纪要转写、知识库解析等）占位。
 * V1.1 接入 BullMQ + Redis 队列后，在此注册 Processor。
 *
 * 依赖（待接入时安装）：
 * - bullmq
 * - @nestjs/bullmq
 */
@Module({})
export class JobsModule {}
