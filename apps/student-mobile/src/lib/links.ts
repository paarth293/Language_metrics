import { Linking } from "react-native";
import { PUBLIC_SITE_URL, STUDENT_WEB_URL } from "../config/env";

export const WebLinks = {
  register: `${PUBLIC_SITE_URL}/register/student`,
  forgotPassword: `${PUBLIC_SITE_URL}/forgot-password`,
  wallet: `${STUDENT_WEB_URL}/wallet`,
  classroom: (bookingId: string) => `${STUDENT_WEB_URL}/live/${encodeURIComponent(bookingId)}`,
  faq: `${STUDENT_WEB_URL}/faq`,
  support: `${STUDENT_WEB_URL}/support`,
  terms: `${STUDENT_WEB_URL}/terms`,
  privacy: `${STUDENT_WEB_URL}/privacy`,
} as const;

/** Opens a Language Metrics web page. Returns false if the device refused to open it. */
export async function openWebLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
