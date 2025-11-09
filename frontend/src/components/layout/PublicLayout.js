import React from 'react';
import { Outlet } from 'react-router-dom';
import NavHome from './NavHome'; // The public-facing Navbar
import Footer from './Footer'; // A new Footer component

const PublicLayout = () => {
    return (
        <div className="bg-primary text-light-gray min-h-screen flex flex-col">
             {/* <Navbar /> */}<NavHome />
            <main className="flex-grow">
                {/* The Outlet will render the specific public page (e.g., HomePage) */}
                <Outlet />
            </main>
        </div>
    );
};

export default PublicLayout;