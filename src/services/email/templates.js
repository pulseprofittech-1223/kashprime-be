const emailTemplates = {
  // Welcome Email  
welcomeEmail: (user, context) => {
  const { full_name, email, user_tier } = user;
  const currentYear = new Date().getFullYear();
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to LUMIVOX</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f8fafc;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
      }
      .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
      .content { padding: 40px 30px; }
      .cta-button {
        display: inline-block;
        background: #667eea;
        color: white;
        text-decoration: none;
        padding: 14px 28px;
        border-radius: 8px;
        font-weight: 600;
        margin-top: 25px;
      }
      .footer {
        background: #f8fafc;
        padding: 30px;
        text-align: center;
        font-size: 14px;
        color: #718096;
        border-top: 1px solid #e2e8f0;
      }
    </style>
  </head>
  <body>
    <div style="padding: 20px 0;">
      <div class="container">
        <div class="header">
          <h1>Welcome to LUMIVOX!</h1>
          <p style="margin: 0;">Your account has been successfully created</p>
        </div>

        <div class="content">
          <p>Hello <strong>${full_name}</strong>,</p>
          <p>We're excited to have you on board. Your <strong>${user_tier}</strong> account is now active and ready to use.</p>

          <p>You can log in to your dashboard to manage your profile, access platform features, and stay updated on your account activities.</p>

          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="cta-button">Go to Dashboard</a>
          </div>

          <p style="margin-top: 25px;">If you need any assistance, feel free to contact our support team at any time.</p>
          <p>Welcome aboard,<br><strong>The LUMIVOX Team</strong></p>
        </div>

        <div class="footer">
          <p><strong>LUMIVOX</strong> — Secure, Smart, and Simple</p>
          <p>© ${currentYear} LUMIVOX. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
},


  // Password Reset OTP Email Template  
  passwordResetOTP: (userData, otp) => {
    const { full_name, email } = userData;
    const currentYear = new Date().getFullYear();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - LUMIVOX</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0; 
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: normal;
          }
          .content { 
            background: #ffffff; 
            padding: 30px; 
            border: 1px solid #e1e5e9; 
            border-top: none; 
            line-height: 1.8;
          }
          .otp-box { 
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); 
            border: 2px solid #667eea; 
            padding: 25px; 
            text-align: center; 
            margin: 25px 0; 
            border-radius: 12px; 
          }
          .otp-code { 
            font-size: 36px; 
            font-weight: bold; 
            color: #667eea; 
            letter-spacing: 8px; 
            margin: 15px 0; 
            font-family: 'Courier New', monospace;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            border-radius: 0 0 8px 8px; 
            border: 1px solid #e1e5e9; 
            border-top: none; 
            font-size: 14px; 
            color: #6c757d; 
          }
          .warning { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .warning h3 {
            margin-top: 0;
            color: #856404;
          }
          @media only screen and (max-width: 600px) {
            .container { padding: 10px; }
            .content { padding: 20px; }
            .otp-code { font-size: 28px; letter-spacing: 6px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LUMIVOX</h1>
            <h2>Password Reset Request</h2>
          </div>
          
          <div class="content">
            <p>Hello <strong>${full_name}</strong>,</p>
            
            <p>We received a request to reset your password for your LUMIVOX account. Use the verification code below to proceed:</p>
            
            <div class="otp-box">
              <p><strong>Your Verification Code:</strong></p>
              <div class="otp-code">${otp}</div>
              <p><small>This code will expire in <strong>10 minutes</strong></small></p>
            </div>
            
            <div class="warning">
              <h3>Security Notice:</h3>
              <ul style="margin-bottom: 0;">
                <li><strong>Never share this code</strong> with anyone</li>
                <li>LUMIVOX will <strong>never ask for this code</strong> via phone or email</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>This code can only be used <strong>once</strong> and expires in 10 minutes</li>
              </ul>
            </div>
            
            <p>If you're having trouble, contact our support team for assistance.</p>
            
            <p>Best regards,<br><strong>The LUMIVOX Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This email was sent to <strong>${email}</strong></p>
            <p>© ${currentYear} LUMIVOX. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Password Change Confirmation Template
  passwordChangeConfirmation: (userData) => {
    const { full_name, email } = userData;
    const currentYear = new Date().getFullYear();
    const changeTime = new Date().toLocaleString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed - LUMIVOX</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e1e5e9; border-top: none; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e1e5e9; border-top: none; font-size: 14px; color: #6c757d; }
          .alert { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed Successfully</h1>
          </div>
          
          <div class="content">
            <p>Hello <strong>${full_name}</strong>,</p>
            
            <p>This email confirms that your LUMIVOX account password was successfully changed on <strong>${changeTime}</strong>.</p>
            
            <div class="alert">
              <p><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
            </div>
            
            <p>Your account security is important to us. Keep your account secure by:</p>
            <ul>
              <li>Using a unique, strong password</li>
              <li>Never sharing your password with anyone</li>
              <li>Regularly updating your password</li>
              <li>Logging out from shared devices</li>
            </ul>
            
            <p>Best regards,<br><strong>The LUMIVOX Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This email was sent to <strong>${email}</strong></p>
            <p>© ${currentYear} LUMIVOX. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

module.exports = emailTemplates;