import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, "ok" | "error"> = {
      api: "ok",
      postgres: "ok",
      redis: "ok",
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.postgres = "error";
    }

    try {
      await this.redis.connect();
      await this.redis.client.ping();
    } catch {
      checks.redis = "error";
    }

    const healthy = Object.values(checks).every((v) => v === "ok");

    return {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
