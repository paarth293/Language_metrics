export async function sendVerificationOTP(email: string, otp: string): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev"; // Default for Resend test accounts

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not configured. Email will not be sent. OTP:", otp);
    // In dev mode without keys, we could return true so the flow doesn't break,
    // but we should warn clearly.
    return true; 
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: "Verify your email address",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify your email</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f4f4f5; text-align: center; border-radius: 6px; letter-spacing: 4px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code expires in 5 minutes.</p>
            <p style="color: #71717a; font-size: 14px; margin-top: 40px;">
              If you did not create this account, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to send email via Resend:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}
