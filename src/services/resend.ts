import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY as string);
export async function sendEmail(
  to: string[],
  subject: string,
  body: string,
): Promise<void> {
  await resend.emails.send({
    from: "LMS-Platform <onboarding@resend.dev>",
    to,
    subject,
    html: body,
  });
}

const verifyEmailTemplate = (token: string): string => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
      }
      .container {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 100%;
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 40px 20px;
        text-align: center;
        color: white;
      }
      .header h1 {
        font-size: 28px;
        margin-bottom: 10px;
      }
      .content {
        padding: 40px;
        text-align: center;
      }
      .icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      .content h2 {
        font-size: 24px;
        color: #333;
        margin-bottom: 15px;
      }
      .content p {
        color: #666;
        font-size: 16px;
        line-height: 1.6;
        margin-bottom: 30px;
      }
      .code-box {
        background: #f5f5f5;
        border-left: 4px solid #667eea;
        padding: 20px;
        border-radius: 8px;
        margin: 30px 0;
      }
      .code-box p {
        font-size: 14px;
        margin-bottom: 10px;
        color: #666;
      }
      .code {
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 8px;
        color: #667eea;
        font-family: "Courier New", monospace;
      }
      .button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 40px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: inline-block;
        text-decoration: none;
        transition:
          transform 0.3s,
          box-shadow 0.3s;
        margin-bottom: 15px;
      }
      .button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
      }
      .link {
        color: #f9f9f9;
        text-decoration: none;
        font-weight: 600;
      }
      .footer {
        background: #f9f9f9;
        padding: 20px;
        text-align: center;
        font-size: 12px;
        color: #999;
        border-top: 1px solid #eee;
      }
      .timer {
        color: #ff6b6b;
        font-weight: 600;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${process.env.APP_NAME}</h1>
      </div>
      <div class="content">
        <div class="icon">✉️</div>
        <h2>Verify Your Email</h2>
        <p>
          Thank you for signing up! Please verify your email address to activate
          your account and get started.
        </p>

        <p>click the button below to verify your email:</p>
        <a href="${process.env.VERIFICATION_LINK}?verificationToken=${token}" class="button">Verify Email Address</a>
        <p style="margin-top: 20px; font-size: 14px">
          This link expires in <strong>15 minutes</strong>
        </p>

        <div class="timer">⏱️ Expires: 15 minutes</div>
      </div>
      <div class="footer">
        <p>If you didn't create this account, please ignore this email.</p>
        <p style="margin-top: 10px">
          © ${new Date().getFullYear()} LMS Platform. All rights reserved.
        </p>
      </div>
    </div>
  </body>
</html>
`;

export { verifyEmailTemplate };
