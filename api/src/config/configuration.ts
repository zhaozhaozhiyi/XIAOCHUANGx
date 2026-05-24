export default () => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  api: {
    prefix: process.env.API_PREFIX ?? "v1",
  },
  cors: {
    origins: process.env.CORS_ORIGINS ?? "http://localhost:3000",
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  session: {
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    ttlSeconds: parseInt(process.env.AUTH_SESSION_TTL_SECONDS ?? "604800", 10),
  },
  auth: {
    devMode: process.env.AUTH_DEV_MODE === "true",
    otpFixed: process.env.AUTH_OTP_FIXED ?? "123456",
    otpTtlSeconds: parseInt(process.env.AUTH_OTP_TTL_SECONDS ?? "300", 10),
    otpResendSeconds: parseInt(process.env.AUTH_OTP_RESEND_SECONDS ?? "60", 10),
    otpDailyLimit: parseInt(process.env.AUTH_OTP_DAILY_LIMIT ?? "10", 10),
  },
});
