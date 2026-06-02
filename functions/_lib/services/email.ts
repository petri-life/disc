// Email sending via Resend's HTTP API. Workers have no SMTP — HTTP only.
// https://resend.com/docs/api-reference/emails/send-email

const RESEND_URL = 'https://api.resend.com/emails'

export class EmailError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

interface SendArgs {
  apiKey: string
  from: string         // e.g. "Petri Disc <onboarding@resend.dev>"
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(args: SendArgs): Promise<void> {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new EmailError(res.status, `resend ${res.status}: ${body}`)
  }
}

export function magicLinkEmail(args: {
  appOrigin: string
  code: string
  email: string
  ttlMinutes: number
}): { subject: string; text: string; html: string } {
  // /login/callback — NOT /auth/callback. The /auth/* prefix is owned by the
  // Pages Function that imports this file. A click-thru to /auth/callback would
  // hit the Hono router, miss every route, and 404. /login/callback is a pure
  // FE route served by the SPA shell.
  const url = `${args.appOrigin}/login/callback?code=${args.code}`
  const subject = 'Sign in to Petri Disc'
  const text =
    `Click the link below to sign in to Petri Disc.\n\n` +
    `${url}\n\n` +
    `This link expires in ${args.ttlMinutes} minutes. ` +
    `If you didn't request this, ignore this email.\n`
  const html =
    `<p>Click the link below to sign in to Petri Disc.</p>` +
    `<p><a href="${url}">Sign in</a></p>` +
    `<p><small>This link expires in ${args.ttlMinutes} minutes. ` +
    `If you didn't request this, ignore this email.</small></p>`
  return { subject, text, html }
}
