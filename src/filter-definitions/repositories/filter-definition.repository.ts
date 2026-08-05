import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  FilterDefinition,
  FilterDefinitionDocument,
} from '../schemas/filter-definition.schema';

@Injectable()
export class FilterDefinitionRepository {
  constructor(
    @InjectModel(FilterDefinition.name)
    private readonly model: Model<FilterDefinitionDocument>,
  ) {}

  async findActive(): Promise<FilterDefinitionDocument[]> {
    return this.model
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean()
      .exec() as Promise<FilterDefinitionDocument[]>;
  }

  async findActiveByKey(key: string): Promise<FilterDefinitionDocument | null> {
    return this.model
      .findOne({ isActive: true, key })
      .lean()
      .exec() as Promise<FilterDefinitionDocument | null>;
  }

  async findAll(): Promise<FilterDefinitionDocument[]> {
    return this.model
      .find()
      .sort({ displayOrder: 1, name: 1 })
      .lean()
      .exec() as Promise<FilterDefinitionDocument[]>;
  }

  async findByKey(key: string): Promise<FilterDefinitionDocument | null> {
    return this.model
      .findOne({ key })
      .lean()
      .exec() as Promise<FilterDefinitionDocument | null>;
  }

  async findById(id: string): Promise<FilterDefinitionDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<FilterDefinitionDocument | null>;
  }

  async countByKey(key: string, excludeId?: string): Promise<number> {
    const filter: Record<string, unknown> = { key, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async create(
    data: Partial<FilterDefinition>,
  ): Promise<FilterDefinitionDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<FilterDefinition>,
  ): Promise<FilterDefinitionDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<FilterDefinitionDocument | null>;
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
