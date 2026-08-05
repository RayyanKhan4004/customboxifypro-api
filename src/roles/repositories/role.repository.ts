import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Role, RoleDocument } from '../schemas/role.schema';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectModel(Role.name) private readonly model: Model<RoleDocument>,
  ) {}

  async findById(id: string): Promise<RoleDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<RoleDocument | null>;
  }

  async findByKey(key: string): Promise<RoleDocument | null> {
    return this.model
      .findOne({ key })
      .lean()
      .exec() as Promise<RoleDocument | null>;
  }

  async findActiveById(id: string): Promise<RoleDocument | null> {
    return this.model
      .findOne({ _id: id, status: 'active' })
      .lean()
      .exec() as Promise<RoleDocument | null>;
  }

  async findAllActive(): Promise<RoleDocument[]> {
    return this.model
      .find({ status: 'active' })
      .sort({ name: 1 })
      .lean()
      .exec() as Promise<RoleDocument[]>;
  }

  async countByKey(key: string, excludeId?: string): Promise<number> {
    const filter: Record<string, unknown> = { key };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<Role>): Promise<RoleDocument> {
    return this.model.create(data) as Promise<RoleDocument>;
  }

  async update(id: string, data: Partial<Role>): Promise<RoleDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<RoleDocument | null>;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
