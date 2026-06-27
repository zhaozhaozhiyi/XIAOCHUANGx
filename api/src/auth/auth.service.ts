import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthProfile } from "@jlc/contracts";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RequestUser } from "../common/auth-user";

const OTP_KEY = (phone: string) => `auth:otp:${phone}`;
const OTP_SEND_KEY = (phone: string) => `auth:otp:send:${phone}`;
const OTP_DAILY_KEY = (phone: string, day: string) =>
  `auth:otp:daily:${day}:${phone}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private maskPhone(phone: string): string {
    return `${phone.slice(0, 3)}****${phone.slice(7)}`;
  }

  private async ensureDefaultTenant() {
    const existing = await this.prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    return this.prisma.tenant.create({
      data: { name: "小窗 · 企业租户" },
    });
  }

  async sendCode(phone: string) {
    await this.redis.connect();
    const resendSeconds = this.config.get<number>("auth.otpResendSeconds", 60);
    const dailyLimit = this.config.get<number>("auth.otpDailyLimit", 10);
    const ttl = this.config.get<number>("auth.otpTtlSeconds", 300);

    const sendLock = await this.redis.client.get(OTP_SEND_KEY(phone));
    if (sendLock) {
      throw new HttpException(
        `请 ${resendSeconds} 秒后再获取验证码`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const day = new Date().toISOString().slice(0, 10);
    const dailyCount = await this.redis.client.incr(OTP_DAILY_KEY(phone, day));
    if (dailyCount === 1) {
      await this.redis.client.expire(OTP_DAILY_KEY(phone, day), 86400);
    }
    if (dailyCount > dailyLimit) {
      throw new HttpException(
        "今日验证码发送次数已达上限",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.config.get<boolean>("auth.devMode", true)
      ? this.config.get<string>("auth.otpFixed", "123456")
      : this.generateOtp();

    await this.redis.client.set(OTP_KEY(phone), code, "EX", ttl);
    await this.redis.client.set(OTP_SEND_KEY(phone), "1", "EX", resendSeconds);

    // 生产环境在此调用短信网关；开发模式仅打日志
    if (this.config.get<boolean>("auth.devMode", true)) {
      console.log(`[auth:dev] OTP for ${phone}: ${code}`);
    }

    return { ok: true as const, resendAfterSeconds: resendSeconds };
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async login(phone: string, code: string) {
    await this.redis.connect();
    const stored = await this.redis.client.get(OTP_KEY(phone));
    if (!stored || stored !== code.trim()) {
      throw new BadRequestException("验证码错误或已失效，请重新获取");
    }
    await this.redis.client.del(OTP_KEY(phone));

    const tenant = await this.ensureDefaultTenant();
    const user = await this.prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        tenantId: tenant.id,
        nickname: "研究员",
      },
      update: {},
      include: { tenant: true },
    });

    const sessionTtl = this.config.get<number>("session.ttlSeconds", 604800);
    const expiresAt = new Date(Date.now() + sessionTtl * 1000);
    const authSession = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt,
      },
    });

    const sessionToken = this.signSessionToken(authSession.id, user.id);
    const profile = this.toProfile(user.phone, user.nickname, user.tenant.name);

    return { ok: true as const, sessionToken, profile };
  }

  async logout(sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true as const };
  }

  async resolveSessionToken(token: string): Promise<RequestUser | null> {
    const secret = this.config.get<string>("session.secret", "dev-secret");
    let payload: { sid: string; sub: string };
    try {
      payload = jwt.verify(token, secret) as { sid: string; sub: string };
    } catch {
      return null;
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { tenant: true } } },
    });

    if (!session) return null;

    return {
      id: session.user.id,
      phone: session.user.phone,
      nickname: session.user.nickname,
      tenantId: session.user.tenantId,
      tenantName: session.user.tenant.name,
      sessionId: session.id,
    };
  }

  toProfile(phone: string, nickname: string, tenantName: string): AuthProfile {
    return {
      phone,
      maskedPhone: this.maskPhone(phone),
      nickname,
      tenantName,
      loggedInAt: new Date().toISOString(),
    };
  }

  private signSessionToken(sessionId: string, userId: string): string {
    const secret = this.config.get<string>("session.secret", "dev-secret");
    const ttl = this.config.get<number>("session.ttlSeconds", 604800);
    return jwt.sign({ sid: sessionId, sub: userId }, secret, {
      expiresIn: ttl,
    });
  }
}
