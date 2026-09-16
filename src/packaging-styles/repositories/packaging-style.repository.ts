import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PackagingStyle,
  PackagingStyleDocument,
} from '../schemas/packaging-style.schema';

@Injectable()
export class PackagingStyleRepository {
  constructor(
    @InjectModel(PackagingStyle.name)
    private readonly model: Model<PackagingStyleDocument>,
  ) {}

  async listActive(search?: string): Promise<PackagingStyleDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (search)
      filter.name = { $regex: this.escapeRegex(search), $options: 'i' };
    return this.model
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<PackagingStyleDocument[]>;
  }

  async listAll(): Promise<PackagingStyleDocument[]> {
    return this.model
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<PackagingStyleDocument[]>;
  }

  async findById(id: string): Promise<PackagingStyleDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<PackagingStyleDocument | null>;
  }

  async countBySlug(slug: string, excludeId?: string): Promise<number> {
    const filter: Record<string, unknown> = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<PackagingStyle>): Promise<PackagingStyleDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<PackagingStyle>,
  ): Promise<PackagingStyleDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<PackagingStyleDocument | null>;
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
