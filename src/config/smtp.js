const nodemailer = require("nodemailer");
require("dotenv").config();

 

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
  