import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import AuctionListPage from '../features/auction/pages/AuctionListPage';
import AuctionConsolePage from '../features/auction/pages/AuctionConsolePage';
import AuctionCreatePage from '../features/auction/pages/AuctionCreatePage';
import OrderListPage from '../features/order/pages/OrderListPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/auction/console" replace />,
      },
      {
        path: 'auction/console',
        element: <AuctionConsolePage />,
      },
      {
        path: 'auction/create',
        element: <AuctionCreatePage />,
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
    element: <Navigate to="/auction/console" replace />,
  },
]);

export default router;