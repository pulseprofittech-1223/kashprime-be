const nodemailer = require("nodemailer");
require("dotenv").config();

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });



const transporter = nodemailer.createTransport({
  host: "send-us.ahasend.com", 
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass:  process.env.EMAIL_PASSWORD,
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false,
  },
});

module.exports = transporter;


module.exports = transporter;
  