import { IsOptional, IsString, MaxLength } from "class-validator";

export class BranchChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
