import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // forwardRef required: AuthModule imports UsersModule, and UsersModule
    // imports AuthModule (for AuthService in UsersController). Both sides
    // must use forwardRef() for NestJS to resolve the circular graph.
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Cast to 'unknown' then 'number' to satisfy TS strictness and avoid 'any'.
          // At runtime, the library still receives your string (e.g., "1d", "15m")
          // from the environment variables and processes it perfectly.
          expiresIn: configService.getOrThrow<string>(
            'JWT_EXPIRES_IN',
          ) as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

