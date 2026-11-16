import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, sellerHomeGuard } from './core/auth';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'panou' },
  { path: 'panou', canActivate: [authGuard, sellerHomeGuard], title: 'Panou · Porumbar', loadComponent: () => import('./pages/panou/panou') },
  // Adresa veche a vederii 3D: acum 3D e în pagina Arbore (comutatorul 2D / 3D).
  { path: 'arbore/3d', redirectTo: ({ queryParams }) => `/arbore?${new URLSearchParams({ ...queryParams, vedere: '3d' })}` },
  { path: 'arbore', canActivate: [authGuard], title: 'Arbore · Porumbar', loadComponent: () => import('./pages/retea/arbore') },
  { path: 'retea', redirectTo: 'arbore' },
  { path: 'intra', canActivate: [guestGuard], title: 'Intră în cont · Porumbar', loadComponent: () => import('./pages/auth/intra') },
  { path: 'cont-nou', canActivate: [guestGuard], title: 'Cont nou · Porumbar', loadComponent: () => import('./pages/auth/cont-nou') },
  { path: 'parola-uitata', title: 'Parolă uitată · Porumbar', loadComponent: () => import('./pages/auth/parola-uitata') },
  { path: 'parola-noua/:token', title: 'Parolă nouă · Porumbar', loadComponent: () => import('./pages/auth/parola-noua') },
  { path: 'porumbar', canActivate: [authGuard], title: 'Porumbarul meu', loadComponent: () => import('./pages/porumbar/porumbar') },
  { path: 'porumbei/pedigree', canActivate: [authGuard], title: 'Pedigree pe hârtie · Porumbar', loadComponent: () => import('./pages/pedigree-hartie/pedigree-hartie') },
  { path: 'porumbei/nou', canActivate: [authGuard], title: 'Porumbel nou', loadComponent: () => import('./pages/porumbel-form/porumbel-form') },
  { path: 'porumbei/:id/editeaza', canActivate: [authGuard], title: 'Editează porumbelul', loadComponent: () => import('./pages/porumbel-form/porumbel-form') },
  { path: 'porumbei/:id/tiparire', canActivate: [authGuard], title: 'Tipărește pedigree-ul · Porumbar', loadComponent: () => import('./pages/porumbel/tiparire') },
  { path: 'porumbei/:id', canActivate: [authGuard], title: 'Porumbel', loadComponent: () => import('./pages/porumbel/porumbel') },
  { path: 'vanzator', canActivate: [adminGuard], title: 'Consola vânzătorului · Porumbar', loadComponent: () => import('./pages/admin/consola') },
  { path: 'vanzari', canActivate: [authGuard], title: 'Vânzări · Porumbar', loadComponent: () => import('./pages/vanzari/vanzari') },
  // Pagina deschisă de codul QR: fără cont.
  { path: 'p/:token', title: 'Pedigree · Porumbar', loadComponent: () => import('./pages/public/public-pedigree') },
  { path: 'cont', canActivate: [authGuard], title: 'Contul meu', loadComponent: () => import('./pages/auth/cont') },
  { path: '**', redirectTo: 'panou' },
];
