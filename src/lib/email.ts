// ============================================
// Email Service - Modular for production swap
// ============================================
// In production, replace mockSend with actual Nodemailer/SendGrid/SES setup

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Mock email sender for development
async function mockSend(params: EmailParams): Promise<boolean> {
  console.log(`[Email] To: ${params.to}`);
  console.log(`[Email] Subject: ${params.subject}`);
  console.log(`[Email] HTML length: ${params.html.length} chars`);
  return true;
}

// Production email sender (uncomment when SMTP is configured)
// import nodemailer from 'nodemailer';
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: parseInt(process.env.SMTP_PORT || '587'),
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

// async function productionSend(params: EmailParams): Promise<boolean> {
//   try {
//     await transporter.sendMail({
//       from: `"MeetLive" <${process.env.EMAIL_FROM}>`,
//       to: params.to,
//       subject: params.subject,
//       html: params.html,
//       text: params.text,
//     });
//     return true;
//   } catch (error) {
//     console.error('Email send failed:', error);
//     return false;
//   }
// }

const sendEmail = mockSend; // Swap to productionSend in production

export const EmailTemplates = {
  meetingInvite: (params: {
    meetingTitle: string;
    hostName: string;
    date: string;
    time: string;
    timezone: string;
    joinLink: string;
    meetingType: string;
  }): EmailParams => ({
    to: '', // Set by caller
    subject: `You're invited: ${params.meetingTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">MeetLive</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #0f172a; margin-top: 0;">You're Invited to a Meeting</h2>
          <p style="color: #475569; line-height: 1.6;">
            <strong>${params.hostName}</strong> has invited you to join a meeting.
          </p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #334155;"><strong>Meeting:</strong> ${params.meetingTitle}</p>
            <p style="margin: 5px 0; color: #334155;"><strong>Date:</strong> ${params.date}</p>
            <p style="margin: 5px 0; color: #334155;"><strong>Time:</strong> ${params.time} (${params.timezone})</p>
            <p style="margin: 5px 0; color: #334155;"><strong>Type:</strong> ${params.meetingType}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.joinLink}" style="background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Join Meeting
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 14px; text-align: center;">
            If the button doesn't work, copy this link: ${params.joinLink}
          </p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">MeetLive - Crystal Clear Meetings, Every Time</p>
        </div>
      </div>
    `,
    text: `You're invited to: ${params.meetingTitle}\nHost: ${params.hostName}\nDate: ${params.date}\nTime: ${params.time} (${params.timezone})\nJoin: ${params.joinLink}`,
  }),

  emailVerification: (params: { name: string; verificationLink: string }): EmailParams => ({
    to: '',
    subject: 'Verify Your Email - MeetLive',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">MeetLive</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #0f172a; margin-top: 0;">Verify Your Email Address</h2>
          <p style="color: #475569; line-height: 1.6;">
            Hi ${params.name}, please verify your email address to get started with MeetLive.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.verificationLink}" style="background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Verify Email
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${params.name}, verify your email: ${params.verificationLink}`,
  }),

  passwordReset: (params: { name: string; resetLink: string }): EmailParams => ({
    to: '',
    subject: 'Reset Your Password - MeetLive',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">MeetLive</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #0f172a; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #475569; line-height: 1.6;">
            Hi ${params.name}, we received a request to reset your password. Click below to set a new one.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.resetLink}" style="background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 14px;">
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `Hi ${params.name}, reset your password: ${params.resetLink}`,
  }),

  meetingCancelled: (params: { meetingTitle: string; hostName: string; scheduledDate: string }): EmailParams => ({
    to: '',
    subject: `Meeting Cancelled: ${params.meetingTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">MeetLive</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #0f172a; margin-top: 0;">Meeting Cancelled</h2>
          <p style="color: #475569; line-height: 1.6;">
            The meeting <strong>${params.meetingTitle}</strong> scheduled for ${params.scheduledDate} has been cancelled by ${params.hostName}.
          </p>
        </div>
      </div>
    `,
    text: `Meeting "${params.meetingTitle}" scheduled for ${params.scheduledDate} has been cancelled by ${params.hostName}.`,
  }),

  meetingReminder: (params: { meetingTitle: string; date: string; time: string; joinLink: string }): EmailParams => ({
    to: '',
    subject: `Reminder: ${params.meetingTitle} starts soon`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">MeetLive</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #0f172a; margin-top: 0;">Meeting Reminder</h2>
          <p style="color: #475569; line-height: 1.6;">
            Your meeting <strong>${params.meetingTitle}</strong> is coming up!
          </p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #334155;"><strong>Date:</strong> ${params.date}</p>
            <p style="margin: 5px 0; color: #334155;"><strong>Time:</strong> ${params.time}</p>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${params.joinLink}" style="background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Join Meeting
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Reminder: "${params.meetingTitle}" on ${params.date} at ${params.time}. Join: ${params.joinLink}`,
  }),
};

export async function sendMeetingInvite(email: string, params: Parameters<typeof EmailTemplates.meetingInvite>[0]) {
  const template = EmailTemplates.meetingInvite(params);
  return sendEmail({ ...template, to: email });
}

export async function sendVerificationEmail(email: string, params: Parameters<typeof EmailTemplates.emailVerification>[0]) {
  const template = EmailTemplates.emailVerification(params);
  return sendEmail({ ...template, to: email });
}

export async function sendPasswordResetEmail(email: string, params: Parameters<typeof EmailTemplates.passwordReset>[0]) {
  const template = EmailTemplates.passwordReset(params);
  return sendEmail({ ...template, to: email });
}

export async function sendMeetingCancellationEmail(email: string, params: Parameters<typeof EmailTemplates.meetingCancelled>[0]) {
  const template = EmailTemplates.meetingCancelled(params);
  return sendEmail({ ...template, to: email });
}
