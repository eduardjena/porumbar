import { boot } from './boot.js';
import { createApp } from './app.js';
import { config } from './config.js';

await boot();
createApp().listen(config.port, () => console.log(`[porumbar] Pornit pe http://localhost:${config.port}`));
