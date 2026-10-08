import { withdrawalCodeApi } from "@/api/withdrawal-code.api";
import type { RequestSignalOptions } from "@/types/api";

export const withdrawalCodeService = {
  getStatus(options: RequestSignalOptions = {}) {
    return withdrawalCodeApi.getStatus(options);
  },

  create(code: string, confirm: string) {
    return withdrawalCodeApi.create(code, confirm);
  },

  verify(code: string) {
    return withdrawalCodeApi.verify(code);
  },

  change(currentCode: string, newCode: string, confirm: string) {
    return withdrawalCodeApi.change(currentCode, newCode, confirm);
  },

  requestReset() {
    return withdrawalCodeApi.requestReset();
  },

  verifyReset(otpCode: string) {
    return withdrawalCodeApi.verifyReset(otpCode);
  },

  confirmReset(resetToken: string, newCode: string, confirm: string) {
    return withdrawalCodeApi.confirmReset(resetToken, newCode, confirm);
  },
};
