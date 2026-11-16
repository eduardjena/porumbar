import { boot } from './boot.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { startReminders } from './subscriptions.js';

await boot();
startReminders();
createApp().listen(config.port, () => console.log(`[porumbar] Pornit pe http://localhost:${config.port}`));
