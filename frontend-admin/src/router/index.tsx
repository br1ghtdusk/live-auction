import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import AuthLayout from '../layouts/AuthLayout';
import LoginPage from '../features/auth/pages/LoginPage';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import AuctionListPage from '../features/auction/pages/AuctionListPage';
import AuctionConsolePage from '../features/auction/pages/AuctionConsolePage';
import OrderListPage from '../features/order/pages/OrderListPage';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'auction',
        element: <AuctionConsolePage />,
      },
      {
        path: 'auction/list',
        element: <AuctionListPage />,
      },
      {
        path: 'order',
        element: <OrderListPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;
