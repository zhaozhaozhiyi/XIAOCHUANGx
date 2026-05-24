import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SessionGuard } from "../common/guards/session.guard";
import { RequestUser } from "../common/auth-user";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SendCodeDto } from "./dto/send-code.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("send-code")
  sendCode(@Body() dto: SendCodeDto) {
    return this.auth.sendCode(dto.phone.trim());
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone.trim(), dto.code.trim());
  }

  @Post("logout")
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  async logout(@CurrentUser() user: RequestUser) {
    await this.auth.logout(user.sessionId);
    return { ok: true as const };
  }

  @Get("me")
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: RequestUser) {
    return {
      profile: this.auth.toProfile(
        user.phone,
        user.nickname,
        user.tenantName,
      ),
    };
  }
}
