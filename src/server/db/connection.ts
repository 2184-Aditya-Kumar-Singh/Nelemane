import "server-only";

import mongoose from "mongoose";

import { getEnv } from "@/lib/env";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type GlobalWithMongoose = typeof globalThis & {
  __nelemaneMongoose?: MongooseCache;
};

const globalWithMongoose = globalThis as GlobalWithMongoose;
const cached =
  globalWithMongoose.__nelemaneMongoose ??
  ({ connection: null, promise: null } satisfies MongooseCache);

globalWithMongoose.__nelemaneMongoose = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.connection) {
    return cached.connection;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(getEnv().MONGODB_URI, { bufferCommands: false })
      .then(() => mongoose)
      .catch((error: unknown) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}
