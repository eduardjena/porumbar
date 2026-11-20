import { ApplicationConfig, Injector, effect, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, untracked } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withNavigationErrorHandler, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/api';
import { AuthService } from './core/auth';
import { CatalogService } from './core/catalog';
import { currentLang, guestLang, useLang } from './core/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Paginile se aduc în fundal după pornire: trecerea de la una la alta nu mai așteaptă descărcarea.
      withPreloading(PreloadAllModules),
      // După o versiune nouă a aplicației, paginile vechi (fișiere cu alt nume) nu mai există: o tab deschisă dinainte
      // ar rămâne blocată. Reîncărcăm pagina spre adresa cerută, o singură dată.
      withNavigationErrorHandler((e) => {
        const msg = String((e.error as Error)?.message ?? e.error);
        if (!/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)) return;
        try {
          const [lastUrl, lastAt] = (sessionStorage.getItem('porumbar.reload') ?? '').split('|');
          if (lastUrl === e.url && Date.now() - Number(lastAt) < 60_000) return; // tocmai am încercat: nu intrăm în buclă
          sessionStorage.setItem('porumbar.reload', `${e.url}|${Date.now()}`);
        } catch {
          /* fără spațiu local: reîncărcăm oricum */
        }
        location.assign(e.url);
      }),
    ),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const catalog = inject(CatalogService);
      const injector = inject(Injector);
      // Catalogul nu blochează pornirea; dacă pică, paginile îl cer din nou.
      catalog.load().catch(() => undefined);
      await auth.load();
      // Limba: a contului; fără cont, cea aleasă pe telefon (doar limbile publice).
      await useLang(auth.account()?.lang ?? guestLang());
      // La intrare / ieșire din cont (sau când vânzătorul schimbă limba contului) se schimbă și limba ecranului.
      effect(
        () => {
          const code = auth.account()?.lang ?? guestLang();
          if (code !== untracked(currentLang)) void useLang(code).then(() => catalog.reload().catch(() => undefined));
        },
        { injector },
      );
    }),
  ],
};
