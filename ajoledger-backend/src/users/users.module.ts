import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    // forwardRef required: AuthModule imports UsersModule (for UsersService),
    // and UsersModule now imports AuthModule (for AuthService in UsersController).
    // forwardRef() breaks the circular reference at the module graph level.
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

