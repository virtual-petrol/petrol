const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

// We DO NOT use 'cors' here because we are using 'onCall' (callable functions)

exports.sendInvoice = functions.https.onCall((data, context) => {
    
    // 1. Validation: Ensure Config exists
    const gmailEmail = functions.config().gmail.email;
    const gmailPassword = functions.config().gmail.password;

    if (!gmailEmail || !gmailPassword) {
        console.error("Gmail credentials missing in Firebase config.");
        throw new functions.https.HttpsError('failed-precondition', 'Server is not configured (Email missing).');
    }

    // 2. Setup Transporter (Done inside function to be safe)
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: gmailEmail,
            pass: gmailPassword,
        },
    });

    // 3. Get Data
    const { to, subject, html } = data;

    const mailOptions = {
        from: `"Nepal Pay Business" <${gmailEmail}>`,
        to: to,
        subject: subject,
        html: html,
    };

    // 4. Send Email
    return transporter.sendMail(mailOptions)
        .then((info) => {
            console.log("Email sent:", info);
            return { success: true, message: "Email sent!" };
        })
        .catch((error) => {
            console.error("Nodemailer Error:", error);
            // Throw a specific error so the frontend sees it
            throw new functions.https.HttpsError('internal', error.message);
        });
});
