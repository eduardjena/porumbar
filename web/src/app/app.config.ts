import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/api';
import { AuthService } from './core/auth';
import { CatalogService } from './core/catalog';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    provideAppInitializer(() => {
      // Catalogul nu blochează pornirea; dacă pică, paginile îl cer din nou.
      inject(CatalogService).load().catch(() => undefined);
      return inject(AuthService).load();
    }),
  ],
};
