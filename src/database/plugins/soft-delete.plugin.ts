import { Schema } from 'mongoose';

/**
 * Adds soft-delete fields and query scoping to a schema. All reads and writes
 * go through the plugin's pre-hooks, so `deletedAt: null` filtering is applied
 * automatically. Unique partial indexes (e.g. slug) include `deletedAt` so
 * deleted records can reuse slugs/keys.
 */
export function applySoftDelete(schema: Schema): Schema {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  });

  const excludeDeleted = function (this: {
    where: (filter: Record<string, unknown>) => void;
  }): void {
    this.where({ deletedAt: null });
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('findOneAndDelete', excludeDeleted);

  schema.statics.findWithDeleted = function (filter: Record<string, unknown>) {
    return this.find({ ...filter, deletedAt: { $ne: null } });
  };

  return schema;
}

export function isSoftDeleted(doc: { deletedAt?: Date | null }): boolean {
  return Boolean(doc.deletedAt);
}
