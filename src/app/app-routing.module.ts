import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { BrowseComponent } from './pages/browse/browse.component';
import { ReadComponent } from './pages/read/read.component';
import { LibraryComponent } from './pages/library/library.component';
import { CreateComponent } from './pages/create/create.component';
import { AuthGuard } from './services/auth.guard';
import { NovelDetailComponent } from './pages/novel-detail/novel-detail.component';
import { SearchComponent } from './pages/search/search.component';
import { AdminGuard } from './services/admin.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'browse', component: BrowseComponent },
  { path: 'novel/:id', component: NovelDetailComponent },
  { path: 'read/:id', component: ReadComponent },
  { path: 'read/:id/:chapterNumber', component: ReadComponent },
  { path: 'search', component: SearchComponent },
  { path: 'library', component: LibraryComponent, canActivate: [AuthGuard] },
  { 
    path: 'profile', 
    loadComponent: () => import('./pages/profile/profile.component').then(c => c.ProfileComponent),
    canActivate: [AuthGuard] 
  },
  { 
    path: 'profile/:id', 
    loadComponent: () => import('./pages/profile/profile.component').then(c => c.ProfileComponent)
  },
  { path: 'create', component: CreateComponent, canActivate: [AuthGuard] },
  { 
    path: 'novel-create', 
    loadComponent: () => import('./pages/novel-create/novel-create.component').then(c => c.NovelCreateComponent),
    canActivate: [AuthGuard] 
  },
  { 
    path: 'my-novels', 
    loadComponent: () => import('./pages/my-novels/my-novels.component').then(c => c.MyNovelsComponent),
    canActivate: [AuthGuard] 
  },
  { 
    path: 'auth', 
    loadChildren: () => import('./pages/auth/auth.module').then(m => m.AuthModule) 
  },
  { 
    path: 'admin', 
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout.component').then(c => c.AdminLayoutComponent),
    canActivate: [AuthGuard, AdminGuard],
    children: [
      { 
        path: '', 
        loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(c => c.AdminDashboardComponent)
      },
      { 
        path: 'users', 
        loadComponent: () => import('./pages/admin/user-list/user-list.component').then(c => c.UserListComponent)
      },
      { 
        path: 'users/edit/:id', 
        loadComponent: () => import('./pages/admin/user-edit/user-edit.component').then(c => c.UserEditComponent)
      },
      { 
        path: 'users/details/:id', 
        loadComponent: () => import('./pages/admin/user-details/user-details.component').then(c => c.UserDetailsComponent)
      },
      { 
        path: 'novels', 
        loadComponent: () => import('./pages/admin/novel-list/novel-list.component').then(c => c.NovelListComponent)
      },
      {
        path: 'genres',
        loadComponent: () => import('./pages/admin/genre-management/genre-management.component').then(c => c.GenreManagementComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
