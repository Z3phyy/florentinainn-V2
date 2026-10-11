import { Aggregate, Query, Schema } from "mongoose";

const QUERY_HOOKS = [
  "countDocuments",
  "find",
  "findOne",
  "findOneAndUpdate",
  "updateOne",
  "updateMany",
] as const;

function mentionsDeletedAt(filter: Record<string, unknown> | undefined): boolean {
  if (!filter) return false;
  if (Object.prototype.hasOwnProperty.call(filter, "deletedAt")) return true;
  return ["$and", "$or", "$nor"].some(
    (op) => Array.isArray(filter[op]) && (filter[op] as Record<string, unknown>[]).some(mentionsDeletedAt),
  );
}

export function softDeletePlugin(schema: Schema) {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: "" },
    deleteReason: { type: String, default: "" },
  });
  schema.index({ deletedAt: 1 });

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, function (this: Query<unknown, unknown>) {
      const options = this.getOptions() as { withDeleted?: boolean };
      if (options.withDeleted) return;
      const filter = this.getFilter() as Record<string, unknown>;
      if (mentionsDeletedAt(filter)) return;
      this.where({ deletedAt: null });
    });
  }

  schema.pre("aggregate", function (this: Aggregate<unknown>) {
    const options = (this.options || {}) as { withDeleted?: boolean };
    if (options.withDeleted) return;
    const pipeline = this.pipeline() as unknown as Record<string, unknown>[];
    const first = pipeline[0] as { $match?: Record<string, unknown> } | undefined;
    if (first?.$match && mentionsDeletedAt(first.$match)) return;
    pipeline.unshift({ $match: { deletedAt: null } });
  });
}
