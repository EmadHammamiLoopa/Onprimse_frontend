import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './pages/messages/chat/chat.component';
import { VideoComponent } from './pages/messages/chat/video/video.component';
import { ErrorComponent } from './pages/error/error.component';
import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/guest.guard';
import { EditProductComponent } from './edit-product/edit-product.component';
import { ProductComponent } from './pages/buy-and-sell/product/product.component';
import { ProductFormComponent } from './pages/buy-and-sell/product-form/product-form.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: 'error/:type',
    component: ErrorComponent
  },
  { path: 'profile', loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfilePageModule), 
    canActivate: [AuthGuard] 

  },

  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.module').then(m => m.AuthPageModule),
    canActivate: [GuestGuard]
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'messages/chat/:id',
    component: ChatComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'chat/:productId',
    component: ChatComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'messages/video/:id',
    component: VideoComponent,
    canActivate: [AuthGuard]
  },  {
    path: 'messages/chat/:productId',
    component: ChatComponent
  },
  { path: 'edit-product/:id', component: ProductFormComponent, canActivate: [AuthGuard]},
  { path: 'product/:id', component: ProductComponent, canActivate: [AuthGuard] },
  {
    path: 'add-product',
    component: ProductFormComponent,
    canActivate: [AuthGuard] 
  },

  
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
