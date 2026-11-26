import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { listenForInstall } from './app/core/install';

// Oferta de instalare vine o singură dată, devreme: o prindem înainte de Angular.
listenForInstall();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
