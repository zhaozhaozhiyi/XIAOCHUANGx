import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SessionGuard } from "../common/guards/session.guard";
import { RequestUser } from "../common/auth-user";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@Controller("projects")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projects.list(user);
  }

  @Get(":id")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.projects.getById(user, id);
  }
}
