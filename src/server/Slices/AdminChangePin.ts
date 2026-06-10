import { adminChangePinRequestSchema } from "../../shared/domain";
import { changeAdminPin } from "../admin";

export async function process(currentPin: string, request: unknown) {
  const parsed = adminChangePinRequestSchema.parse(request);
  await changeAdminPin(currentPin, parsed.newPin);
  return { changed: true };
}
