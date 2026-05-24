import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" && body !== null && "message" in body
            ? (body as { message: string | string[] }).message
            : exception.message;

      response.status(status).json({
        error:
          typeof message === "string"
            ? message
            : Array.isArray(message)
              ? message.join("; ")
              : "请求失败",
        statusCode: status,
      });
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: "服务器内部错误",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
