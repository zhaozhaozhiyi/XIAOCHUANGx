import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ChatSessionDto } from "@jlc/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../common/auth-user";
import { ProjectsService } from "../projects/projects.service";
import { CreateChatSessionDto } from "./dto/create-chat-session.dto";

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  private toDto(session: {
    id: string;
    projectId: string;
    title: string | null;
    createdAt: Date;
  }): ChatSessionDto {
    return {
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
    };
  }

  async create(user: RequestUser, dto: CreateChatSessionDto) {
    if (!dto.projectId && !dto.createProject) {
      throw new BadRequestException("须指定 projectId 或 createProject");
    }
    if (dto.projectId && dto.createProject) {
      throw new BadRequestException("projectId 与 createProject 不可同时传入");
    }

    let projectId: string;
    let workspaceKind: "sandbox" | "local_bound" | "cloud";

    if (dto.createProject) {
      const { project } = await this.projects.create(user, {
        workspaceKind: dto.createProject.workspaceKind,
        baseDir: dto.createProject.baseDir,
        name: dto.createProject.name,
      });
      projectId = project.id;
      workspaceKind = project.workspaceKind;
    } else {
      const { project } = await this.projects.getById(user, dto.projectId!);
      projectId = project.id;
      workspaceKind = project.workspaceKind;
    }

    const session = await this.prisma.chatSession.create({
      data: {
        userId: user.id,
        projectId,
        title: dto.title?.trim() ?? null,
      },
    });

    return {
      session: this.toDto(session),
      project: { id: projectId, workspaceKind },
    };
  }

  async list(user: RequestUser, projectId?: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        userId: user.id,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return { sessions: sessions.map((s) => this.toDto(s)) };
  }

  /** 分支新会话：继承父会话 projectId（PRD §5.3.2.1） */
  async branch(
    user: RequestUser,
    parentSessionId: string,
    title?: string,
  ) {
    const parent = await this.getById(user, parentSessionId);
    return this.create(user, {
      projectId: parent.project.id,
      title,
    });
  }

  async getById(user: RequestUser, sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { project: true },
    });
    if (!session) throw new NotFoundException("对话会话不存在");
    if (session.userId !== user.id) {
      throw new ForbiddenException("无权访问该会话");
    }
    return {
      session: this.toDto(session),
      project: {
        id: session.project.id,
        workspaceKind: session.project.workspaceKind,
      },
    };
  }
}
