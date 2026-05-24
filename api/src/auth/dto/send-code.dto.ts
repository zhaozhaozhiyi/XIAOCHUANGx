import { IsString, Matches } from "class-validator";

export class SendCodeDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: "请输入正确的 11 位手机号" })
  phone!: string;
}
