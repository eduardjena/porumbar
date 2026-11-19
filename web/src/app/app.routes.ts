import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, sellerHomeGuard } from './core/auth';
import { t } from './core/i18n';

/** Titlul paginii din dicționar, în limba ecranului (App îl reface și când se schimbă limba). */
const title = (key: string) => () => t(key);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'panou' },
  // Panoul (Grilă / Listă / Rezultate concurs): un cadru comun (antetul și bara stau pe loc), se schimbă doar ce e sub ele.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/panou/porumbar-cadru'),
    children: [
      { path: 'panou', canActivate: [sellerHomeGuard], title: title('titlu.panou'), loadComponent: () => import('./pages/panou/panou') },
      { path: 'porumbar', title: title('titlu.porumbar'), loadComponent: () => import('./pages/porumbar/porumbar') },
      // „Rezultate concurs”, cu submeniurile Listare rezultate / Introdu rezultat nou.
      { path: 'concursuri', pathMatch: 'full', redirectTo: 'concursuri/lista' },
      { path: 'concursuri/lista', title: title('titlu.rezultate'), loadComponent: () => import('./pages/rezultate/rezultate-toate') },
      { path: 'concursuri/nou', title: title('titlu.concurs'), loadComponent: () => import('./pages/concurs/concurs-rezultate') },
    ],
  },
  // Adresele de dinainte.
  { path: 'rezultate', redirectTo: 'concursuri/lista' },
  { path: 'concursuri/rezultate', redirectTo: 'concursuri/nou' },
  // Adresa veche a vederii 3D (scoasă): duce la Arbore, la același porumbel.
  { path: 'arbore/3d', redirectTo: ({ queryParams }) => `/arbore?${new URLSearchParams({ ...queryParams, vedere: 'carduri' })}` },
  { path: 'arbore', canActivate: [authGuard], title: title('titlu.arbore'), loadComponent: () => import('./pages/retea/arbore') },
  { path: 'retea', redirectTo: 'arbore' },
  { path: 'intra', canActivate: [guestGuard], title: title('titlu.intra'), loadComponent: () => import('./pages/auth/intra') },
  { path: 'cont-nou', canActivate: [guestGuard], title: title('titlu.cont_nou'), loadComponent: () => import('./pages/auth/cont-nou') },
  { path: 'parola-uitata', title: title('titlu.parola_uitata'), loadComponent: () => import('./pages/auth/parola-uitata') },
  { path: 'parola-noua/:token', title: title('titlu.parola_noua'), loadComponent: () => import('./pages/auth/parola-noua') },
  { path: 'perechi', canActivate: [authGuard], title: title('titlu.perechi'), loadComponent: () => import('./pages/perechi/perechi') },
  { path: 'perechi/:id', canActivate: [authGuard], title: title('titlu.pereche'), loadComponent: () => import('./pages/perechi/pereche') },
  { path: 'scaneaza', canActivate: [authGuard], title: title('titlu.scaneaza'), loadComponent: () => import('./pages/scaneaza/scaneaza') },
  { path: 'porumbei/pedigree', canActivate: [authGuard], title: title('titlu.pedigree_hartie'), loadComponent: () => import('./pages/pedigree-hartie/pedigree-hartie') },
  { path: 'porumbei/nou', canActivate: [authGuard], title: title('titlu.porumbel_nou'), loadComponent: () => import('./pages/porumbel-form/porumbel-form') },
  { path: 'porumbei/:id/editeaza', canActivate: [authGuard], title: title('titlu.editeaza'), loadComponent: () => import('./pages/porumbel-form/porumbel-form') },
  { path: 'porumbei/:id/tiparire', canActivate: [authGuard], title: title('titlu.tiparire'), loadComponent: () => import('./pages/porumbel/tiparire') },
  { path: 'porumbei/:id', canActivate: [authGuard], title: title('titlu.porumbel'), loadComponent: () => import('./pages/porumbel/porumbel') },
  { path: 'vanzator', canActivate: [adminGuard], title: title('titlu.vanzator'), loadComponent: () => import('./pages/admin/consola') },
  { path: 'vanzari', canActivate: [authGuard], title: title('titlu.vanzari'), loadComponent: () => import('./pages/vanzari/vanzari') },
  // Pagina deschisă de codul QR: fără cont.
  { path: 'p/:token', title: title('titlu.public'), loadComponent: () => import('./pages/public/public-pedigree') },
  { path: 'cont', canActivate: [authGuard], title: title('titlu.cont'), loadComponent: () => import('./pages/auth/cont') },
  { path: '**', redirectTo: 'panou' },
];
