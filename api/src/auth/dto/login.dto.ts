import { Equals, IsBoolean, IsString, Matches } from "class-validator";

export class LoginDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: "请输入正确的 11 位手机号" })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "请输入 6 位验证码" })
  code!: string;

  @IsBoolean()
  @Equals(true, { message: "请先阅读并同意用户协议与隐私政策" })
  agreed!: boolean;
}
