import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Category, CategoryDocument } from '../schemas/category.schema';

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectModel(Category.name) private readonly model: Model<CategoryDocument>,
  ) {}

  async findById(id: string): Promise<CategoryDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<CategoryDocument | null>;
  }

  async findBySlug(slug: string): Promise<CategoryDocument | null> {
    return this.model
      .findOne({ slug })
      .lean()
      .exec() as Promise<CategoryDocument | null>;
  }

  async findActiveBySlug(slug: string): Promise<CategoryDocument | null> {
    return this.model
      .findOne({ slug, isActive: true })
      .lean()
      .exec() as Promise<CategoryDocument | null>;
  }

  async listActive(): Promise<CategoryDocument[]> {
    return this.model
      .find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<CategoryDocument[]>;
  }

  async listAll(): Promise<CategoryDocument[]> {
    return this.model
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<CategoryDocument[]>;
  }

  async countBySlug(slug: string, excludeId?: string): Promise<number> {
    const filter: Record<string, unknown> = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async countChildren(parentId: string): Promise<number> {
    return this.model.countDocuments({ parentId, deletedAt: null }).exec();
  }

  async create(data: Partial<Category>): Promise<CategoryDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<Category>,
  ): Promise<CategoryDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<CategoryDocument | null>;
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
}
