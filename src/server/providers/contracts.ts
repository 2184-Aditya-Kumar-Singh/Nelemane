import type { Buffer } from "node:buffer";

export type DeliveryStatus = "SENT" | "FAILED" | "SKIPPED";
export type StorageVisibility = "public" | "private";
export type StorageResourceType = "image" | "raw";

export interface DeliveryResult {
  status: DeliveryStatus;
  providerId?: string;
}

export interface EmailMessage {
  to: string;
  template: string;
  dedupeKey: string;
  subject: string;
  text: string;
  html: string;
}

export interface SmsMessage {
  to: string;
  template: string;
  dedupeKey: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<DeliveryResult>;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<DeliveryResult>;
}

export interface UploadRequest {
  bytes: Buffer;
  contentType: string;
  folder: string;
  resourceType: StorageResourceType;
  visibility: StorageVisibility;
}

export interface StoredAsset {
  publicId: string;
  url: string;
  resourceType: StorageResourceType;
  visibility: StorageVisibility;
}

export interface StorageProvider {
  upload(request: UploadRequest): Promise<StoredAsset>;
  getSignedUrl(publicId: string, expiresInSeconds: number): Promise<string>;
  delete(publicId: string): Promise<void>;
}
