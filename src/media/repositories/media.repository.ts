import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Media, MediaDocument, MediaStatus } from '../schemas/media.schema';

type MongoFilter = Record<string, unknown>;

@Injectable()
export class MediaRepository {
  constructor(
    @InjectModel(Media.name) private readonly model: Model<MediaDocument>,
  ) {}

  async findById(id: string): Promise<MediaDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<MediaDocument | null>;
  }

  async findByKey(key: string): Promise<MediaDocument | null> {
    return this.model
      .findOne({ key })
      .lean()
      .exec() as Promise<MediaDocument | null>;
  }

  /** Batch media lookup by object keys (used to resolve product image URLs). */
  async findByKeys(keys: string[]): Promise<MediaDocument[]> {
    if (keys.length === 0) return [];
    return this.model
      .find({ key: { $in: keys }, deletedAt: null })
      .lean()
      .exec() as Promise<MediaDocument[]>;
  }

  async find(
    filter: MongoFilter,
    sort: Record<string, 1 | -1>,
    limit: number,
    skip: number,
  ): Promise<MediaDocument[]> {
    return this.model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec() as Promise<MediaDocument[]>;
  }

  async count(filter: MongoFilter): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<Media>): Promise<MediaDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<Media>,
  ): Promise<MediaDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<MediaDocument | null>;
  }

  async transitionStatus(
    id: string,
    from: MediaStatus,
    to: MediaStatus,
  ): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { _id: id, status: from, deletedAt: null },
        { $set: { status: to } },
      )
      .exec();
    return result.modifiedCount === 1;
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
