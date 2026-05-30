import type { RouteObject } from 'react-router-dom';

export interface RouteMeta {
  title?: string;
  icon?: React.ReactNode;
  requiresAuth?: boolean;
}

export type AppRoute = RouteObject & {
  meta?: RouteMeta;
  children?: AppRoute[];
}

export const routes: AppRoute[] = [
  {
    path: '/login',
    meta: { title: '登录' },
  },
  {
    path: '/',
    meta: { requiresAuth: true },
    children: [
      {
        index: true,
        path: '/dashboard',
        meta: { title: '数据大盘' },
      },
      {
        path: '/auction',
        meta: { title: '拍卖控制台' },
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
