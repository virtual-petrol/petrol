const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

// 1. Transporter Setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: functions.config().gmail.email,
        pass: functions.config().gmail.password,
    },
});

// 2. The Cloud Function
exports.sendInvoice = functions.https.onCall((data, context) => {
    
    // FIX: We do NOT check context.auth because our login is fake.
    // If you remove this comment block, it will fail with "Permission Denied".
    
    const { to, subject, html } = data;

    const mailOptions = {
        from: `"Nepal Pay Business" <${functions.config().gmail.email}>`,
        to: to,
        subject: subject,
        html: html,
    };

    return transporter.sendMail(mailOptions)
        .then((info) => {
            console.log("Email sent successfully:", info);
            return { success: true, message: "Email sent!" };
        })
        .catch((error) => {
            console.error("Error sending email:", error);
            // Throw the error so the frontend sees it
            throw new functions.https.HttpsError('internal', error.message);
        });
});
