/**
 * 短信网关抽象。生产接入阿里云/腾讯云前，由运维确认厂商并实现对应 Provider。
 * MVP 使用 AUTH_DEV_MODE + 控制台日志，不调用本接口。
 */
export const SMS_PROVIDER = Symbol("SMS_PROVIDER");

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** 开发占位：仅打日志，不发送 */
export class DevSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    console.log(`[sms:dev] OTP to ${phone}: ${code}`);
  }
}
