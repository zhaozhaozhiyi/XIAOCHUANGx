import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>("redis.url")!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async connect() {
    if (this.client.status === "wait") {
      await this.client.connect();
    }
  }
}
