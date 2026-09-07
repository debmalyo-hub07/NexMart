import transporter from '../config/email';
import { env } from '../config/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]+>/g, ''),
  });
}

// ─── OTP Email Template ────────────────────────────────────────────────────────

export function buildOtpEmail(name: string, otp: string, type: 'verify' | 'resend' = 'verify'): string {
  const digits = otp.split('');

  const digitBoxes = digits.map((d) => `
    <td style="padding:0 4px;">
      <table cellpadding="0" cellspacing="0"><tr><td style="
        width:48px;
        height:60px;
        background:#1a1035;
        border:1.5px solid #6d28d9;
        border-radius:10px;
        text-align:center;
        vertical-align:middle;
        font-size:26px;
        font-weight:800;
        color:#c084fc;
        font-family:Georgia,serif;
        line-height:60px;
      ">${d}</td></tr></table>
    </td>
  `).join('');

  const subjectLine = type === 'resend'
    ? "Here is your new verification code"
    : "One step away from NexMart";

  const verifyUrl = `${env.APP_URL}/customer/verify-otp?email=${encodeURIComponent('')}`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Verify your NexMart account</title>
</head>
<body style="margin:0;padding:0;background-color:#07050f;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#07050f;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <!--[if mso]><table width="560"><tr><td><![endif]-->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #2d1b69;">

        <!-- TOP GRADIENT BAR -->
        <tr>
          <td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#9333ea,#c026d3);height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- HEADER: Logo + Brand -->
        <tr>
          <td align="center" style="background:#0d0820;padding:32px 40px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="
                    width:44px;height:44px;
                    background:linear-gradient(135deg,#7c3aed,#d946ef);
                    border-radius:12px;
                    text-align:center;
                    vertical-align:middle;
                    font-size:22px;
                    font-weight:900;
                    color:#ffffff;
                    font-family:Arial,sans-serif;
                    line-height:44px;
                  ">N</td></tr></table>
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">NexMart</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr>
          <td style="background:#0d0820;padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="height:1px;background:#2d1b69;font-size:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#0f0a1e;padding:36px 40px 20px;">
            <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:22px;font-weight:800;color:#f3e8ff;">Hi ${name},</p>
            <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px;color:#9ca3af;line-height:1.6;">${subjectLine}. Enter the code below to verify your email address. It expires in <strong style="color:#c084fc;">10 minutes</strong>.</p>

            <!-- OTP DIGIT BOXES -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
              <tr>${digitBoxes}</tr>
            </table>

            <!-- SECURITY NOTE -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1c1208;border:1px solid #78350f;border-radius:10px;padding:14px 18px;">
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#d97706;line-height:1.5;">
                    <strong>Security tip:</strong> NexMart will never ask for your verification code. Do not share this with anyone.
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA BUTTON -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
              <tr>
                <td style="border-radius:40px;background:linear-gradient(135deg,#7c3aed,#9333ea,#c026d3);">
                  <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:40px;letter-spacing:0.3px;">
                    Verify My Account &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;text-align:center;line-height:1.5;">
              If you didn&rsquo;t create a NexMart account, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0a0615;padding:20px 40px;border-top:1px solid #1e1040;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:12px;color:#4b5563;text-align:center;line-height:1.6;">
                  &copy; 2026 NexMart &middot; All rights reserved<br/>
                  <span style="color:#374151;">This email was sent to ${name} as part of your account registration.</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BOTTOM GRADIENT BAR -->
        <tr>
          <td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#9333ea,#c026d3);height:2px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// ─── Order Status Email ────────────────────────────────────────────────────────

export async function sendOrderStatusEmail(
  to: string,
  customerName: string,
  orderId: string,
  status: string
): Promise<void> {
  const statusConfig: Record<string, { label: string; emoji: string }> = {
    confirmed:        { label: 'Order Confirmed',    emoji: '&#127881;' },
    processing:       { label: 'Order Processing',   emoji: '&#9881;' },
    shipped:          { label: 'Order Shipped',      emoji: '&#128666;' },
    out_for_delivery: { label: 'Out for Delivery',   emoji: '&#128230;' },
    delivered:        { label: 'Order Delivered',    emoji: '&#9989;' },
    cancelled:        { label: 'Order Cancelled',    emoji: '&#10060;' },
    refunded:         { label: 'Payment Refunded',   emoji: '&#128176;' },
    returned:         { label: 'Order Returned',     emoji: '&#128260;' },
  };

  const info = statusConfig[status] || { label: `Status: ${status}`, emoji: '&#128203;' };

  await sendEmail({
    to,
    subject: `NexMart — ${info.label} · ${orderId}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#07050f;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07050f;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #2d1b69;">
      <tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#c026d3);height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td align="center" style="background:#0d0820;padding:28px 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0"><tr><td style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#d946ef);border-radius:10px;text-align:center;line-height:40px;font-size:20px;font-weight:900;color:#fff;font-family:Arial;">N</td></tr></table>
          </td>
          <td style="vertical-align:middle;font-family:Arial;font-size:20px;font-weight:800;color:#fff;">NexMart</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#0f0a1e;padding:36px 40px;text-align:center;">
        <p style="margin:0 0 8px;font-size:40px;">${info.emoji}</p>
        <p style="margin:0 0 6px;font-family:Arial;font-size:22px;font-weight:800;color:#f3e8ff;">${info.label}</p>
        <p style="margin:0 0 24px;font-family:Arial;font-size:14px;color:#9ca3af;">Hi ${customerName}, here&rsquo;s your order update.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
          <tr><td style="background:#1a1035;border:1px solid #4c1d95;border-radius:10px;padding:16px 32px;text-align:left;">
            <p style="margin:0 0 4px;font-family:Arial;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Order ID</p>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:15px;font-weight:700;color:#c084fc;">${orderId}</p>
          </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr><td style="border-radius:40px;background:linear-gradient(135deg,#7c3aed,#c026d3);">
            <a href="${env.APP_URL}/orders" style="display:inline-block;padding:13px 36px;font-family:Arial;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">View Order &rarr;</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#0a0615;padding:18px 40px;border-top:1px solid #1e1040;text-align:center;">
        <p style="margin:0;font-family:Arial;font-size:12px;color:#4b5563;">&copy; 2026 NexMart &middot; All rights reserved</p>
      </td></tr>
      <tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#c026d3);height:2px;font-size:0;">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
  });
}

export async function sendAgentStatusEmail(
  to: string,
  agentName: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const isApproved = status === 'approved';
  const subject = isApproved 
    ? 'NexMart — Delivery Agent Account Approved!' 
    : 'NexMart — Delivery Agent Account Registration Update';
  
  const heading = isApproved ? '🎉 Welcome to the NexMart Fleet!' : 'Registration Status Update';
  const message = isApproved 
    ? 'Your delivery agent registration has been approved by the admin. You can now log in to the dashboard and start accepting delivery assignments!'
    : 'Thank you for your interest in NexMart. Unfortunately, your delivery agent registration has not been approved at this time. If you believe this is in error, please contact support.';

  await sendEmail({
    to,
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#07050f;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07050f;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #2d1b69;">
      <tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#c026d3);height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td align="center" style="background:#0d0820;padding:28px 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0"><tr><td style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#d946ef);border-radius:10px;text-align:center;line-height:40px;font-size:20px;font-weight:900;color:#fff;font-family:Arial;">N</td></tr></table>
          </td>
          <td style="vertical-align:middle;font-family:Arial;font-size:20px;font-weight:800;color:#fff;">NexMart</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#0f0a1e;padding:36px 40px;text-align:center;">
        <p style="margin:0 0 6px;font-family:Arial;font-size:22px;font-weight:800;color:#f3e8ff;">${heading}</p>
        <p style="margin:0 0 24px;font-family:Arial;font-size:14px;color:#9ca3af;line-height:1.6;">Hi ${agentName},<br/><br/>${message}</p>
        ${isApproved ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr><td style="border-radius:40px;background:linear-gradient(135deg,#7c3aed,#c026d3);">
            <a href="${env.APP_URL}/delivery/login" style="display:inline-block;padding:13px 36px;font-family:Arial;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">Log In to Dashboard &rarr;</a>
          </td></tr>
        </table>` : ''}
      </td></tr>
      <tr><td style="background:#0a0615;padding:18px 40px;border-top:1px solid #1e1040;text-align:center;">
        <p style="margin:0;font-family:Arial;font-size:12px;color:#4b5563;">&copy; 2026 NexMart &middot; All rights reserved</p>
      </td></tr>
      <tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#c026d3);height:2px;font-size:0;">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
  });
}

export async function sendAgentAssignmentEmail(
  to: string,
  agentName: string,
  orderId: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `NexMart — New Delivery Assignment · ${orderId}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#07050f;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07050f;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #2d1b69;">
      <tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#c026d3);height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td align="center" style="background:#0d0820;padding:28px 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0"><tr><td style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#d946ef);border-radius:10px;text-align:center;line-height:40px;font-size:20px;font-weight:900;color:#fff;font-family:Arial;">N</td></tr></table>
          </td>
          <td style="vertical-align:middle;font-family:Arial;font-size:20px;font-weight:800;color:#fff;">NexMart</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#0f0a1e;padding:36px 40px;text-align:center;">
        <p style="margin:0 0 6px;font-family:Arial;font-size:22px;font-weight:800;color:#f3e8ff;">New Assignment!</p>
        <p style="margin:0 0 24px;font-family:Arial;font-size:14px;color:#9ca3af;line-height:1.6;">Hi ${agentName},<br/><br/>You have been assigned to deliver order <strong style="color:#c084fc;">${orderId}</strong>. Please check your delivery dashboard for more details.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr><td style="border-radius:40px;background:linear-gradient(135deg,#7c3aed,#c026d3);">
            <a href="${env.APP_URL}/delivery/dashboard" style="display:inline-block;padding:13px 36px;font-family:Arial;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">View Dashboard &rarr;</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#0a0615;padding:18px 40px;border-top:1px solid #1e1040;text-align:center;">
        <p style="margin:0;font-family:Arial;font-size:12px;color:#4b5563;">&copy; 2026 NexMart &middot; All rights reserved</p>
      </td></tr>
      <tr><td style="background:linear-gradient(90deg,#5b21b6,#7c3aed,#c026d3);height:2px;font-size:0;">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
  });
}
