import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NombaModule } from '../nomba/nomba.module';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';

@Module({
  imports: [
    NombaModule, // provides NombaService → CyclesService.disburseCyclePayout()
    AuthModule,  // provides AuthService → CyclesController TX PIN gate
  ],
  controllers: [CyclesController],
  providers: [CyclesService],
})
export class CyclesModule {}

