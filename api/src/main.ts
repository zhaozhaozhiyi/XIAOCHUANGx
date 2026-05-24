import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const prefix = config.get<string>("api.prefix", "v1");
  app.setGlobalPrefix(prefix);

  const corsOrigins = config.get<string>("cors.origins", "http://localhost:3000");
  app.enableCors({
    origin: corsOrigins.split(",").map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("小窗 API")
    .setDescription("业务 API（账号、项目、对话会话元数据）")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = config.get<number>("port", 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/${prefix}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}

bootstrap();
