import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceKind } from "@prisma/client";
import type { ProjectDto } from "@jlc/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../common/auth-user";
import { CreateProjectDto } from "./dto/create-project.dto";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(project: {
    id: string;
    workspaceKind: WorkspaceKind;
    baseDir: string | null;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectDto {
    return {
      id: project.id,
      workspaceKind: project.workspaceKind,
      baseDir: project.baseDir,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async create(user: RequestUser, dto: CreateProjectDto) {
    if (dto.workspaceKind === WorkspaceKind.local_bound && !dto.baseDir?.trim()) {
      throw new BadRequestException("local_bound 项目必须提供 baseDir");
    }
    if (dto.workspaceKind !== WorkspaceKind.local_bound && dto.baseDir) {
      throw new BadRequestException("仅 local_bound 可设置 baseDir");
    }

    const project = await this.prisma.project.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        workspaceKind: dto.workspaceKind,
        baseDir: dto.baseDir?.trim() ?? null,
        name: dto.name?.trim() ?? null,
      },
    });

    return { project: this.toDto(project) };
  }

  async list(user: RequestUser) {
    const projects = await this.prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    return { projects: projects.map((p) => this.toDto(p)) };
  }

  async getById(user: RequestUser, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException("项目不存在");
    if (project.userId !== user.id) {
      throw new ForbiddenException("无权访问该项目");
    }
    return { project: this.toDto(project) };
  }

  /** 新建对话默认：有 Companion 倾向 sandbox，否则 cloud */
  async createDefaultForNewChat(
    user: RequestUser,
    preferCloud = false,
  ): Promise<ProjectDto> {
    const kind = preferCloud ? WorkspaceKind.cloud : WorkspaceKind.sandbox;
    const { project } = await this.create(user, { workspaceKind: kind });
    return project;
  }
}
