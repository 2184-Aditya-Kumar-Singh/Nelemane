import { model, models, Schema, type Model, type Types } from "mongoose";

export interface RoomRecord {
  pgId: Types.ObjectId;
  roomTypeId: Types.ObjectId;
  roomNumber: string;
  floor: string;
  block?: string;
  capacity: number;
  occupiedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<RoomRecord>(
  {
    pgId: { type: Schema.Types.ObjectId, ref: "PG", required: true },
    roomTypeId: { type: Schema.Types.ObjectId, ref: "RoomType", required: true },
    roomNumber: { type: String, required: true, trim: true, maxlength: 30 },
    floor: { type: String, required: true, trim: true, maxlength: 40 },
    block: { type: String, trim: true, maxlength: 60 },
    capacity: { type: Number, required: true, min: 1, max: 50 },
    occupiedCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

roomSchema.index(
  { pgId: 1, block: 1, roomNumber: 1 },
  { unique: true, name: "room_pg_block_number_unique" },
);
roomSchema.index({ pgId: 1, roomTypeId: 1 }, { name: "room_pg_type" });

export const RoomModel =
  (models.Room as Model<RoomRecord> | undefined) ?? model<RoomRecord>("Room", roomSchema);
