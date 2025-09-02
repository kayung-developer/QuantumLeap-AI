// src/components/layout/DashboardLayout.js

import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-primary text-light-gray">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primary p-6 md:p-8">
          {/* This is where the nested child routes from App.js will be rendered */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;