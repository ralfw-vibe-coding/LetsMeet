import { createHash } from "node:crypto";
import { adminPinSchema } from "../shared/domain";
import { getAppSettings, updateAppSettings } from "./db";
import { forbidden, validation } from "./errors";

const DEFAULT_ADMIN_PIN = "000000";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const { adminPinHash } = await getAppSettings();
  if (!adminPinHash) return pin === DEFAULT_ADMIN_PIN;
  return hashPin(pin) === adminPinHash;
}

export async function requireAdmin(pin: string): Promise<void> {
  if (!(await verifyAdminPin(pin))) throw forbidden("Wrong admin PIN.");
}

export async function changeAdminPin(currentPin: string, newPin: string): Promise<void> {
  await requireAdmin(currentPin);
  if (!adminPinSchema.safeParse(newPin).success) {
    throw validation("Admin PIN must be six letters or digits.");
  }
  await updateAppSettings({ adminPinHash: hashPin(newPin) });
}
