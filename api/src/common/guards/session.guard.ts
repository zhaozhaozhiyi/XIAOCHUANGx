import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../../auth/auth.service";
import { RequestUser } from "../auth-user";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: RequestUser;
    }>();

    const authHeader = request.headers.authorization;
    let token: string | undefined;

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      const cookie = request.headers.cookie;
      if (typeof cookie === "string") {
        const match = cookie.match(/(?:^|;\s*)jlc_session=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      throw new UnauthorizedException("未登录");
    }

    const user = await this.auth.resolveSessionToken(token);
    if (!user) {
      throw new UnauthorizedException("会话已失效，请重新登录");
    }

    request.user = user;
    return true;
  }
}
