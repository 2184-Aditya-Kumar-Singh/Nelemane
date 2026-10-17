import { model, models, Schema, type Model, type Types } from "mongoose";

export interface ReviewRecord {
  pgId: Types.ObjectId;
  tenantId: Types.ObjectId;
  rating: number;
  comment?: string;
  editedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewRecord>({
  pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000 },
  editedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });
reviewSchema.index({ pgId: 1, tenantId: 1 }, { unique: true, name: "review_pg_tenant_unique" });
reviewSchema.index({ pgId: 1, createdAt: -1 }, { name: "review_pg_created" });

export const ReviewModel = (models.Review as Model<ReviewRecord> | undefined) ?? model<ReviewRecord>("Review", reviewSchema);
