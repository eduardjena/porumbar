import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'porumbar' },
  { path: 'intra', canActivate: [guestGuard], title: 'Intră în cont · Porumbar', loadComponent: () => import('./pages/auth/intra') },
  { path: 'cont-nou', canActivate: [guestGuard], title: 'Cont nou · Porumbar', loadComponent: () => import('./pages/auth/cont-nou') },
  { path: 'parola-uitata', title: 'Parolă uitată · Porumbar', loadComponent: () => import('./pages/auth/parola-uitata') },
  { path: 'parola-noua/:token', title: 'Parolă nouă · Porumbar', loadComponent: () => import('./pages/auth/parola-noua') },
  { path: 'porumbar', canActivate: [authGuard], title: 'Porumbarul meu', loadComponent: () => import('./pages/porumbar/porumbar') },
  { path: 'porumbei/nou', canActivate: [authGuard], title: 'Porumbel nou', loadComponent: () => import('./pages/porumbel-form/porumbel-form') },
  { path: 'porumbei/:id/editeaza', canActivate: [authGuard], title: 'Editează porumbelul', loadComponent: () => import('./pages/porumbel-form/porumbel-form') },
  { path: 'porumbei/:id', canActivate: [authGuard], title: 'Porumbel', loadComponent: () => import('./pages/porumbel/porumbel') },
  { path: 'cont', canActivate: [authGuard], title: 'Contul meu', loadComponent: () => import('./pages/auth/cont') },
  { path: '**', redirectTo: 'porumbar' },
];
