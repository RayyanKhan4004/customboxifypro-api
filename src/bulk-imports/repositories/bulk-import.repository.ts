import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BulkImport, BulkImportDocument } from '../schemas/bulk-import.schema';

type MongoFilter = Record<string, unknown>;

@Injectable()
export class BulkImportRepository {
  constructor(
    @InjectModel(BulkImport.name)
    private readonly model: Model<BulkImportDocument>,
  ) {}

  async findById(id: string): Promise<BulkImportDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<BulkImportDocument | null>;
  }

  async find(
    filter: MongoFilter,
    sort: Record<string, 1 | -1>,
    limit: number,
    skip: number,
  ): Promise<BulkImportDocument[]> {
    return this.model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec() as Promise<BulkImportDocument[]>;
  }

  async count(filter: MongoFilter): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<BulkImport>): Promise<BulkImportDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<BulkImport>,
  ): Promise<BulkImportDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<BulkImportDocument | null>;
  }
}
