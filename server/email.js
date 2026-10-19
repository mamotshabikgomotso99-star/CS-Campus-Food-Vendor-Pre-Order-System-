const nodemailer = require('nodemailer');

function buildSmtpTransport(configuration, createTransportFactory) {
  const host = configuration.SMTP_HOST?.trim();
  const port = Number(configuration.SMTP_PORT);
  const from = (configuration.SMTP_FROM || configuration.EMAIL_FROM || '').trim();
  const user = configuration.SMTP_USER?.trim();
  const password = configuration.SMTP_PASS;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from || Boolean(user) !== Boolean(password)) {
    return null;
  }

  const transport = createTransportFactory({
    host,
    port,
    secure: configuration.SMTP_SECURE === 'true',
    ...(user ? { auth: { user, pass: password } } : {}),
  });

  return { from, transport };
}

function createSmtpMailer(configuration = process.env, createTransportFactory = nodemailer.createTransport) {
  const smtp = buildSmtpTransport(configuration, createTransportFactory);
  if (!smtp) {
    return null;
  }

  const { from, transport } = smtp;
  return async (recipient, resetUrl) => transport.sendMail({
    from,
    to: recipient,
    subject: 'Reset your Campus Eats password',
    text: `Use this one-time link to reset your Campus Eats password. It expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request a reset, you can ignore this email.`,
    html: `<p>Use this one-time link to reset your Campus Eats password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request a reset, you can ignore this email.</p>`,
  });
}

function createSmtpVerificationMailer(configuration = process.env, createTransportFactory = nodemailer.createTransport) {
  const smtp = buildSmtpTransport(configuration, createTransportFactory);
  if (!smtp) {
    return null;
  }

  const { from, transport } = smtp;
  return async (recipient, verificationUrl) => transport.sendMail({
    from,
    to: recipient,
    subject: 'Verify your Campus Eats email',
    text: `Confirm your email address to activate your Campus Eats student account. This one-time link expires in 24 hours.\n\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Confirm your email address to activate your Campus Eats student account. This one-time link expires in 24 hours.</p><p><a href="${verificationUrl}">Verify email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  });
}

module.exports = { createSmtpMailer, createSmtpVerificationMailer };