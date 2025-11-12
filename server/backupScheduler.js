const cron = require('node-cron');
const { performBackup } = require('./backup.js');
const { intervalToCron } = require('./backupConfig.js');

/**
 * Start backup scheduler
 * @param {Object} config - Full app configuration
 * @returns {Object} Cron job instance
 */
function startBackupScheduler(config) {
  if (!config.backup || !config.backup.enabled) {
    console.log('[Backup Scheduler] Backups are disabled');
    return null;
  }

  const cronExpression = intervalToCron(config.backup.interval);
  console.log(`[Backup Scheduler] Starting scheduler with interval: ${config.backup.interval} (${cronExpression})`);

  const job = cron.schedule(cronExpression, async () => {
    console.log('[Backup Scheduler] Running scheduled backup...');
    const result = await performBackup(config.backup, config.dataDir || './data');

    if (result.success) {
      console.log(`[Backup Scheduler] Backup completed: ${result.filename}`);
    } else {
      console.error(`[Backup Scheduler] Backup failed: ${result.error}`);
    }
  });

  return job;
}

module.exports = {
  startBackupScheduler
};
