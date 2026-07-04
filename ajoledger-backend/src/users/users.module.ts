import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NombaModule } from '../nomba/nomba.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    // forwardRef required: AuthModule imports UsersModule (for UsersService),
    // and UsersModule imports AuthModule (for AuthService in UsersController).
    forwardRef(() => AuthModule),
    NombaModule, // provides NombaService → UsersController (getBanks, resolveAccount)
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
