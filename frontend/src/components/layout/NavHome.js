import React, { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { FaBars, FaTimes } from 'react-icons/fa';
import Button from '../common/Button';

const NavHome = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Effect to handle navbar background change on scroll
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Features', path: '#features' },
        { name: 'Pricing', path: '#pricing' },
        { name: 'Community', path: '/dashboard/marketplace' },
        { name: 'Contact', path: '/contact' },
    ];

    const handleAnchorClick = (e, path) => {
        setIsMobileMenuOpen(false);
        if (path.startsWith('#')) {
            e.preventDefault();
            const targetId = path.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    // --- COLOR LOGIC ---
    // When scrolled: White background, Dark text.
    // When top: Transparent background, White text.
    const navBackground = isScrolled 
        ? 'bg-white/90 backdrop-blur-md border-b border-gray-200 dark:bg-secondary/90 dark:border-border-color shadow-sm' 
        : 'bg-transparent';
    
    const linkColor = isScrolled
        ? 'text-gray-700 hover:text-accent dark:text-gray-200 dark:hover:text-accent'
        : 'text-white hover:text-accent drop-shadow-sm'; // Add shadow for readability on images

    const logoColor = isScrolled
        ? 'text-gray-900 dark:text-white'
        : 'text-white drop-shadow-md';

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${navBackground}`}>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        
                        {/* --- LOGO --- */}
                        <Link to="/" className="flex items-center space-x-2 flex-shrink-0 group">
                            <img src="/app.png" alt="QuantumLeap Logo" className="h-9 w-9 transition-transform group-hover:scale-110" />
                            <span className={`text-2xl font-extrabold tracking-tight transition-colors ${logoColor}`}>
                                Quantum<span className="text-accent">Leap</span>
                            </span>
                        </Link>

                        {/* --- DESKTOP LINKS --- */}
                        <div className="hidden md:flex items-center space-x-8">
                            {navLinks.map(link => (
                                <Link
                                    key={link.name}
                                    to={link.path}
                                    onClick={(e) => handleAnchorClick(e, link.path)}
                                    className={`${linkColor} text-base font-bold transition-colors`}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>

                        {/* --- ACTION BUTTONS --- */}
                        <div className="hidden md:flex items-center space-x-3">
                            <Link to="/login">
                                {/* Dynamic button styling based on scroll */}
                                <button className={`px-5 py-2 rounded-lg font-bold transition-all ${isScrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/20'}`}>
                                    Login
                                </button>
                            </Link>
                            <Link to="/register">
                                <Button variant="primary" className="shadow-lg shadow-accent/20">Get Started</Button>
                            </Link>
                        </div>

                        {/* --- MOBILE MENU BUTTON --- */}
                        <div className="md:hidden">
                            <button 
                                onClick={() => setIsMobileMenuOpen(true)} 
                                className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent ${isScrolled ? 'text-gray-700' : 'text-white'}`}
                            >
                                <FaBars className="h-7 w-7" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* --- MOBILE MENU (Overlay) --- */}
            <Transition.Root show={isMobileMenuOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50 md:hidden" onClose={setIsMobileMenuOpen}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full items-start justify-end p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-x-full"
                                enterTo="opacity-100 translate-x-0"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-x-0"
                                leaveTo="opacity-0 translate-x-full"
                            >
                                <Dialog.Panel className="relative w-full max-w-xs transform overflow-hidden rounded-2xl bg-white dark:bg-secondary p-6 shadow-2xl transition-all border border-gray-100 dark:border-border-color">
                                    <div className="flex items-center justify-between mb-8">
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">Menu</span>
                                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-primary transition-colors">
                                            <FaTimes size={20} />
                                        </button>
                                    </div>
                                    
                                    <div className="flex flex-col space-y-4">
                                        {navLinks.map(link => (
                                            <Link
                                                key={link.name}
                                                to={link.path}
                                                onClick={(e) => handleAnchorClick(e, link.path)}
                                                className="text-lg font-bold text-gray-700 dark:text-gray-200 hover:text-accent transition-colors"
                                            >
                                                {link.name}
                                            </Link>
                                        ))}
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-border-color space-y-3">
                                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="secondary" className="w-full justify-center">Login</Button>
                                        </Link>
                                        <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="primary" className="w-full justify-center shadow-lg shadow-accent/20">Get Started</Button>
                                        </Link>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </>
    );
};

export default NavHome;