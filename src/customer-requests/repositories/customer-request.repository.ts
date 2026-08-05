import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  CustomerRequest,
  CustomerRequestDocument,
} from '../schemas/customer-request.schema';

type MongoFilter = Record<string, unknown>;

@Injectable()
export class CustomerRequestRepository {
  constructor(
    @InjectModel(CustomerRequest.name)
    private readonly model: Model<CustomerRequestDocument>,
  ) {}

  async findById(id: string): Promise<CustomerRequestDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<CustomerRequestDocument | null>;
  }

  async findByIdempotencyKey(
    key: string,
  ): Promise<CustomerRequestDocument | null> {
    return this.model
      .findOne({ idempotencyKey: key })
      .lean()
      .exec() as Promise<CustomerRequestDocument | null>;
  }

  async find(
    filter: MongoFilter,
    sort: Record<string, 1 | -1>,
    limit: number,
    skip: number,
  ): Promise<CustomerRequestDocument[]> {
    return this.model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec() as Promise<CustomerRequestDocument[]>;
  }

  async count(filter: MongoFilter): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async create(
    data: Partial<CustomerRequest>,
  ): Promise<CustomerRequestDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<CustomerRequest>,
  ): Promise<CustomerRequestDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<CustomerRequestDocument | null>;
  }

  async updateMany(
    filter: MongoFilter,
    data: Partial<CustomerRequest>,
  ): Promise<number> {
    const result = await this.model.updateMany(filter, { $set: data }).exec();
    return result.modifiedCount;
  }
}
