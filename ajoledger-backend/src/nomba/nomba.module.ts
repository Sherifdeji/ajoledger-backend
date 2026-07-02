import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NombaService } from './nomba.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
    }),
  ],
  providers: [NombaService],
  exports: [NombaService],
})
export class NombaModule {}
