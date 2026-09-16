import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminHomePageController, PublicHomePageController } from './home-page.controller';
import { HomePageService } from './home-page.service';
import { HomePage, HomePageSchema } from './schemas/home-page.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: HomePage.name, schema: HomePageSchema }]), AuditLogsModule],
  controllers: [AdminHomePageController, PublicHomePageController],
  providers: [HomePageService],
})
export class HomePageModule {}
