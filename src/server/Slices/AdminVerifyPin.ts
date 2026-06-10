import { verifyAdminPin } from "../admin";

export async function process(request: unknown) {
  const pin = String((request as { pin?: unknown }).pin ?? "");
  return { verified: await verifyAdminPin(pin) };
}
