import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SessionGuard } from "../common/guards/session.guard";
import { RequestUser } from "../common/auth-user";
import { BranchChatSessionDto } from "./dto/branch-chat-session.dto";
import { CreateChatSessionDto } from "./dto/create-chat-session.dto";
import { SessionsService } from "./sessions.service";

@ApiTags("chat-sessions")
@Controller("chat-sessions")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateChatSessionDto) {
    return this.sessions.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("projectId") projectId?: string,
  ) {
    return this.sessions.list(user, projectId);
  }

  @Post(":id/branch")
  branch(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: BranchChatSessionDto,
  ) {
    return this.sessions.branch(user, id, dto.title);
  }

  @Get(":id")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.sessions.getById(user, id);
  }
}
