// Express server — drop-in replacement for the Netlify serverless setup.
// Same env vars: USER_NAME, APP_PASSWORD, SENDTO
// Run: node server.mjs   (or: PORT=3000 node server.mjs)

import express from "express";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGIN = "*"; // tighten to your domain in prod if desired

app.use(express.json());
app.use(express.static(__dirname));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Mirror the Netlify function at the same path so the HTML needs no changes
app.post("/.netlify/functions/submit-form", async (req, res) => {
  const { USER_NAME, APP_PASSWORD, SENDTO } = process.env;
  if (!USER_NAME || !APP_PASSWORD || !SENDTO) {
    return res.status(500).json({ error: "Server email config missing" });
  }

  const body = req.body;

  // Honeypot — silently drop bot submissions
  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  const fname = (body.fname || "").trim().slice(0, 80);
  const lname = (body.lname || "").trim().slice(0, 80);
  const email = (body.email || "").trim().slice(0, 160);
  const phone = (body.phone || "").trim().slice(0, 40);
  const stage = (body.stage || "").trim().slice(0, 120);

  if (!fname || !email || !phone) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: USER_NAME, pass: APP_PASSWORD },
  });

  const fullName = `${fname} ${lname}`.trim();
  const ts = new Date().toISOString();
  const subject = `New consultation lead — ${fullName}`;

  const text = [
    `New free-consultation request from mortgage-with-garry landing page.`,
    ``,
    `Name:   ${fullName}`,
    `Email:  ${email}`,
    `Phone:  ${phone}`,
    `Stage:  ${stage || "(not specified)"}`,
    ``,
    `Submitted: ${ts}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
      <h2 style="margin:0 0 6px;color:#6b7a5e">New consultation lead</h2>
      <p style="margin:0 0 18px;color:#666;font-size:13px">From the Mortgage With Garry landing page</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #eee">
        <tr><td style="background:#f7f5ef;width:100px;font-weight:bold">Name</td><td>${escapeHtml(fullName)}</td></tr>
        <tr><td style="background:#f7f5ef;font-weight:bold">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="background:#f7f5ef;font-weight:bold">Phone</td><td><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
        <tr><td style="background:#f7f5ef;font-weight:bold">Stage</td><td>${escapeHtml(stage || "(not specified)")}</td></tr>
      </table>
      <p style="margin-top:20px;color:#888;font-size:12px">Submitted ${ts}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Mortgage With Garry — Landing" <${USER_NAME}>`,
      to: SENDTO,
      replyTo: `"${fullName}" <${email}>`,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("sendMail error:", err);
    return res.status(502).json({ error: "Email send failed" });
  }

  return res.status(200).json({ ok: true });
});

// Serve the landing page at /
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "mortgage-with-garry.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
