function register(ipcMain, { emailClient, tools, mainWindow, loadConfig, saveConfig }) {
  ipcMain.handle('email:configure', (_, config) => {
    emailClient.configure(config);
    const appCfg = loadConfig();
    appCfg.emailConfig = config;
    saveConfig(appCfg);
  });

  ipcMain.handle('email:read', async (_, folder, count) => emailClient.readEmails(folder, count));

  ipcMain.handle('email:send', async (_, to, subject, body) => {
    const confirmed = await tools.confirmSendEmail(mainWindow, to, subject);
    if (!confirmed) throw new Error('用户取消发送');
    return await emailClient.sendEmail(to, subject, body);
  });
}

module.exports = { register };
