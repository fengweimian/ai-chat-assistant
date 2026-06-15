const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

class EmailClient {
  constructor() {
    this.config = null;
  }

  configure(config) {
    this.config = config;
  }

  async sendEmail(to, subject, body) {
    if (!this.config) throw new Error('邮件未配置');
    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort || 465,
      secure: this.config.smtpPort === 465 || !this.config.smtpPort,
      auth: { user: this.config.email, pass: this.config.password }
    });

    await transporter.sendMail({
      from: this.config.email,
      to,
      subject,
      text: body
    });
    return { success: true };
  }

  async readEmails(folder = 'INBOX', count = 10) {
    if (!this.config) throw new Error('邮件未配置');
    const client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort || 993,
      secure: true,
      auth: { user: this.config.email, pass: this.config.password },
      logger: false
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        const messages = [];
        const total = client.mailbox.exists;
        const from = Math.max(1, total - count + 1);

        for await (const msg of client.fetch(`${from}:*`, { envelope: true, source: false })) {
          messages.push({
            id: msg.seq,
            subject: msg.envelope.subject || '(无主题)',
            from: msg.envelope.from?.[0]?.address || '',
            date: msg.envelope.date?.toISOString() || ''
          });
        }
        return messages.reverse();
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}

module.exports = EmailClient;
