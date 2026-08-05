import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';

import { Product, ProductDocument } from '../schemas/product.schema';

type MongoFilter = Record<string, unknown>;

@Injectable()
export class ProductRepository {
  constructor(
    @InjectModel(Product.name) private readonly model: Model<ProductDocument>,
  ) {}

  async findById(id: string): Promise<ProductDocument | null> {
    return this.model.findById(id).exec();
  }

  async findByIdLean(id: string): Promise<ProductDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<ProductDocument | null>;
  }

  async findBySlug(slug: string): Promise<ProductDocument | null> {
    return this.model
      .findOne({ slug })
      .lean()
      .exec() as Promise<ProductDocument | null>;
  }

  async findPublicBySlug(
    slug: string,
    projection: Record<string, number> = {},
  ): Promise<ProductDocument | null> {
    return this.model
      .findOne({ slug, status: 'published', visibility: 'public' })
      .select(projection)
      .lean()
      .exec() as Promise<ProductDocument | null>;
  }

  async countBySlug(slug: string, excludeId?: string): Promise<number> {
    const filter: MongoFilter = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async countBySku(sku: string, excludeId?: string): Promise<number> {
    const filter: MongoFilter = { sku, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async find(
    match: MongoFilter,
    sort: Record<string, 1 | -1>,
    limit: number,
    projection: Record<string, number>,
    skip = 0,
  ): Promise<ProductDocument[]> {
    return this.model
      .find(match)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(projection)
      .maxTimeMS(5000)
      .lean()
      .exec() as Promise<ProductDocument[]>;
  }

  async count(match: MongoFilter): Promise<number> {
    return this.model.countDocuments(match).exec();
  }

  async aggregate<T>(pipeline: PipelineStage[]): Promise<T[]> {
    return this.model.aggregate(pipeline).exec() as Promise<T[]>;
  }

  async create(data: Partial<Product>): Promise<ProductDocument> {
    return this.model.create(data);
  }

  async updateById(
    id: string,
    data: Partial<Product>,
  ): Promise<ProductDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<ProductDocument | null>;
  }

  /** Optimistic concurrency: only applies when `version` matches. */
  async updateByIdVersioned(
    id: string,
    expectedVersion: number,
    data: Partial<Product>,
  ): Promise<ProductDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, version: expectedVersion, deletedAt: null },
        { $set: { ...data, version: expectedVersion + 1 } },
        { new: true },
      )
      .lean()
      .exec() as Promise<ProductDocument | null>;
  }

  async bulkUpdateMany(ids: string[], data: Partial<Product>): Promise<number> {
    const result = await this.model
      .updateMany(
        {
          _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
          deletedAt: null,
        },
        { $set: { ...data, updatedAt: new Date() }, $inc: { version: 1 } },
      )
      .exec();
    return result.modifiedCount;
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { _id: id, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            deletedBy: new Types.ObjectId(deletedBy),
          },
        },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async restore(id: string, updatedBy: string): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { _id: id, deletedAt: { $ne: null } },
        { $set: { deletedAt: null, updatedBy: new Types.ObjectId(updatedBy) } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async softDeleteMany(ids: string[], deletedBy: string): Promise<number> {
    const result = await this.model
      .updateMany(
        {
          _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
          deletedAt: null,
        },
        {
          $set: {
            deletedAt: new Date(),
            deletedBy: new Types.ObjectId(deletedBy),
          },
        },
      )
      .exec();
    return result.modifiedCount;
  }

  async findByIds(
    ids: string[],
    projection: Record<string, number> = {},
  ): Promise<ProductDocument[]> {
    return this.model
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        deletedAt: null,
      })
      .select(projection)
      .lean()
      .exec() as Promise<ProductDocument[]>;
  }
}
