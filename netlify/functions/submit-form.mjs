// Netlify Function: receives form POST, emails Gourav via Gmail SMTP.
// Requires env vars: USER_NAME (Gmail address), APP_PASSWORD (Gmail app password), SENDTO (destination inbox).

import nodemailer from "nodemailer";

const ALLOWED_ORIGIN = "*"; // tighten to your domain in prod if you want, e.g. "https://gaurav-mortgage-ads-landing.netlify.app"

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { USER_NAME, APP_PASSWORD, SENDTO } = process.env;
  if (!USER_NAME || !APP_PASSWORD || !SENDTO) {
    return new Response(
      JSON.stringify({ error: "Server email config missing" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Honeypot — if filled, silently accept and drop.
  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const fname = (body.fname || "").trim().slice(0, 80);
  const lname = (body.lname || "").trim().slice(0, 80);
  const email = (body.email || "").trim().slice(0, 160);
  const phone = (body.phone || "").trim().slice(0, 40);
  const stage = (body.stage || "").trim().slice(0, 120);

  if (!fname || !email || !phone) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  // Basic email sanity check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
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
    return new Response(JSON.stringify({ error: "Email send failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};
