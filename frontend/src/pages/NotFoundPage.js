// frontend/src/pages/NotFoundPage.js

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../components/common/Button';
import { motion } from 'framer-motion';
import { FaHome, FaTachometerAlt, FaExclamationTriangle, FaSearch } from 'react-icons/fa';
import Input from '../components/common/Input';

const NotFoundPage = () => {
    const location = useLocation();

    // Check if the user is inside the dashboard layout or on a public page
    const isDashboardContext = location.pathname.startsWith('/dashboard');

    return (
        <div className="min-h-screen bg-primary text-white flex flex-col items-center justify-center text-center p-4 sm:p-8">
            <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                <div className="relative inline-block">
                    <FaExclamationTriangle className="text-8xl md:text-9xl text-accent/20" />
                    <h1 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl md:text-6xl font-extrabold text-accent">
                        404
                    </h1>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold mt-8 text-gray-900 dark:text-white">
                    Oops! Page Not Found.
                </h2>
                <p className="mt-4 text-md md:text-lg text-gray-600 dark:text-light-gray max-w-lg mx-auto font-medium">
                    We can't seem to find the page you're looking for. It might have been moved, deleted, or maybe you just took a quantum leap into the void.
                </p>

                {/* Search Bar (Optional but helpful) */}
                <div className="mt-8 max-w-sm mx-auto">
                    <div className="relative">
                        <Input
                            type="search"
                            placeholder="Search the site..."
                            className="!pl-10"
                        />
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-light-gray" />
                    </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to={isDashboardContext ? "/dashboard" : "/"}>
                        <Button variant="primary" className="w-full sm:w-auto">
                            {isDashboardContext ?
                                <><FaTachometerAlt className="mr-2" /> Go to Dashboard</> :
                                <><FaHome className="mr-2" /> Go to Homepage</>
                            }
                        </Button>
                    </Link>
                    <Link to="/contact"> {/* Assuming you have a contact or support page */}
                        <Button variant="secondary" className="w-full sm:w-auto">
                            Contact Support
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

// We need an Input component here for the search bar,
// let's define a minimal one or import it from common components.

export default NotFoundPage;