import { Resend } from "resend";

export async function sendMagicLink(email: string, url: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Vocare <hello@vocare.ca>",
    to: email,
    subject: "Your Vocare sign-in link",
    html: `<p>Click below to sign in to Vocare. This link expires in 5 minutes and can only be used once.</p><p><a href="${url}">Sign in to Vocare</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}
