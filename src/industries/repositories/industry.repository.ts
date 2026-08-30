import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Industry, IndustryDocument } from '../schemas/industry.schema';

@Injectable()
export class IndustryRepository {
  constructor(
    @InjectModel(Industry.name) private readonly model: Model<IndustryDocument>,
  ) {}

  async findById(id: string): Promise<IndustryDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<IndustryDocument | null>;
  }

  async findActiveBySlug(slug: string): Promise<IndustryDocument | null> {
    return this.model
      .findOne({ slug, isActive: true })
      .lean()
      .exec() as Promise<IndustryDocument | null>;
  }

  async listActive(search?: string): Promise<IndustryDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (search) {
      filter.name = { $regex: this.escapeRegex(search), $options: 'i' };
    }
    return this.model
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<IndustryDocument[]>;
  }

  async listAll(): Promise<IndustryDocument[]> {
    return this.model
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<IndustryDocument[]>;
  }

  async countBySlug(slug: string, excludeId?: string): Promise<number> {
    const filter: Record<string, unknown> = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<Industry>): Promise<IndustryDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<Industry>,
  ): Promise<IndustryDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<IndustryDocument | null>;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
