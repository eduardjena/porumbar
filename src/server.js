import { boot } from './boot.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { startReminders } from './subscriptions.js';
import { startTreatmentReminders } from './treatment-reminders.js';
import { startImportCleanup } from './table-import.js';

await boot();
startReminders();
startTreatmentReminders();
startImportCleanup();
createApp().listen(config.port, () => console.log(`[porumbar] Pornit pe http://localhost:${config.port}`));
