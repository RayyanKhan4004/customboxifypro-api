import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuditActions } from '../audit-logs/audit-actions';
import { AuditService } from '../audit-logs/audit.service';
import { HomePageDocument, HomePage } from './schemas/home-page.schema';
import { UpdateHomePageDto } from './dto/home-page.dto';

const defaults: UpdateHomePageDto = {
  pageMode: 'home',
  countdownTargetDate: undefined,
  eyebrow: 'CUSTOM PACKAGING, ENGINEERED',
  title: 'Every Brand Deserves A Box',
  titleAccent: 'Worth Opening.',
  description: 'Custom Boxify Pro is a faster way to design, quote, and produce custom packaging from first sketch to finished carton.',
  primaryCtaLabel: 'Explore Packaging',
  primaryCtaHref: '#packaging-style',
  secondaryCtaLabel: 'Contact Now',
  secondaryCtaHref: '#quote',
  customersValue: '500+',
  satisfactionValue: '99%',
};

@Injectable()
export class HomePageService {
  constructor(
    @InjectModel(HomePage.name) private readonly model: Model<HomePageDocument>,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<UpdateHomePageDto> {
    const page = await this.model.findOne({ key: 'home' }).lean().exec();
    return page ? this.toDto(page) : defaults;
  }

  async update(dto: UpdateHomePageDto, actorId: string): Promise<UpdateHomePageDto> {
    const page = await this.model.findOneAndUpdate(
      { key: 'home' },
      { $set: { ...dto, key: 'home' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean().exec();
    await this.audit.log({ actorId, action: AuditActions.HOME_PAGE_UPDATED, resourceType: 'home-page', resourceId: 'home', after: dto });
    return this.toDto(page);
  }

  private toDto(page: Partial<HomePage>): UpdateHomePageDto {
    return {
      pageMode: page.pageMode === 'countdown' ? 'countdown' : 'home',
      countdownTargetDate: page.countdownTargetDate,
      eyebrow: page.eyebrow ?? defaults.eyebrow, title: page.title ?? defaults.title,
      titleAccent: page.titleAccent ?? defaults.titleAccent, description: page.description ?? defaults.description,
      primaryCtaLabel: page.primaryCtaLabel ?? defaults.primaryCtaLabel, primaryCtaHref: page.primaryCtaHref ?? defaults.primaryCtaHref,
      secondaryCtaLabel: page.secondaryCtaLabel ?? defaults.secondaryCtaLabel, secondaryCtaHref: page.secondaryCtaHref ?? defaults.secondaryCtaHref,
      customersValue: page.customersValue ?? defaults.customersValue, satisfactionValue: page.satisfactionValue ?? defaults.satisfactionValue,
    };
  }
}
