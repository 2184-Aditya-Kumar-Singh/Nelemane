import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";

import { getEnv } from "@/lib/env";
import type { EncryptedValue } from "@/server/db/models/pg";

function encryptionKey(): Buffer {
  return Buffer.from(getEnv().DATA_ENCRYPTION_KEY, "base64");
}

export function encryptSensitiveValue(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    algorithm: "AES-256-GCM",
  };
}

export function decryptSensitiveValue(value: EncryptedValue): string {
  if (value.algorithm !== "AES-256-GCM") {
    throw new Error("Unsupported encrypted value format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
