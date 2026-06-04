import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface RouteMeta {
  title?: string;
  icon?: ReactNode;
  requiresAuth?: boolean;
}

export type AppRoute = RouteObject & {
  meta?: RouteMeta;
  children?: AppRoute[];
}

export const routes: AppRoute[] = [
  {
    path: '/',
    meta: { requiresAuth: true },
    children: [
      {
        path: '/auction/console',
        meta: { title: '竞拍控制台' },
      },
      {
        path: '/auction/create',
        meta: { title: '发布拍品' },
      },
      {
        path: '/auction/list',
        meta: { title: '拍品管理' },
      },
      {
        path: '/order',
        meta: { title: '订单管理' },
      },
    ],
  },
  {
    path: '*',
    meta: { title: '404' },
  },
];