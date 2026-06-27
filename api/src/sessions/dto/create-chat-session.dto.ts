import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { WorkspaceKind } from "@prisma/client";

class CreateProjectInlineDto {
  @IsEnum(WorkspaceKind)
  workspaceKind!: WorkspaceKind;

  @ValidateIf((o: CreateProjectInlineDto) => o.workspaceKind === WorkspaceKind.local_bound)
  @IsString()
  baseDir?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class CreateChatSessionDto {
  @ValidateIf((o: CreateChatSessionDto) => !o.createProject)
  @IsString()
  projectId?: string;

  @ValidateIf((o: CreateChatSessionDto) => !o.projectId)
  @ValidateNested()
  @Type(() => CreateProjectInlineDto)
  createProject?: CreateProjectInlineDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
