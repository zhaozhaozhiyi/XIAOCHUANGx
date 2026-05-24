import { WorkspaceKind } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateProjectDto {
  @IsEnum(WorkspaceKind)
  workspaceKind!: WorkspaceKind;

  @ValidateIf((o: CreateProjectDto) => o.workspaceKind === WorkspaceKind.local_bound)
  @IsString()
  baseDir?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
