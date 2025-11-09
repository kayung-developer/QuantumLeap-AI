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
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Features', path: '#features' },
        { name: 'Pricing', path: '#pricing' },
        { name: 'Community', path: '/dashboard/marketplace' }, // Link directly to the public marketplace
        { name: 'Contact', path: '/contact' },
    ];

    // Smooth scroll handler for anchor links (e.g., #features)
    const handleAnchorClick = (e, path) => {
        setIsMobileMenuOpen(false); // Close mobile menu on click
        if (path.startsWith('#')) {
            e.preventDefault();
            const targetId = path.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };
    
    const NavigationLinks = ({ isMobile = false }) => (
        <div className={isMobile ? 'flex flex-col space-y-4' : 'hidden md:flex items-center space-x-8'}>
            {navLinks.map(link => (
                <Link
                    key={link.name}
                    to={link.path}
                    onClick={(e) => handleAnchorClick(e, link.path)}
                    className="text-light-gray hover:text-accent transition-colors text-lg md:text-base"
                >
                    {link.name}
                </Link>
            ))}
        </div>
    );

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-primary/80 backdrop-blur-lg border-b border-border-color' : 'bg-transparent'}`}>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
                            <img src="/app.png" alt="QuantumLeap Logo" className="h-8 w-8" />
                            <span className="text-white text-xl font-bold">QuantumLeap</span>
                        </Link>

                        {/* Desktop Navigation Links */}
                        <NavigationLinks />

                        {/* Action Buttons (Desktop) */}
                        <div className="hidden md:flex items-center space-x-2">
                            <Link to="/login">
                                <Button variant="secondary">Login</Button>
                            </Link>
                            <Link to="/register">
                                <Button variant="primary">Get Started</Button>
                            </Link>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-md text-light-gray hover:text-white hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-accent">
                                <FaBars className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* --- Mobile Menu (Overlay) --- */}
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
                        <div className="fixed inset-0 bg-black bg-opacity-75" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full items-start justify-end p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-x-full"
                                enterTo="opacity-100 translate-x-0"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-x-0"
                                leaveTo="opacity-0 translate-x-full"
                            >
                                <Dialog.Panel className="relative w-full max-w-xs transform overflow-hidden rounded-2xl bg-secondary p-6 text-left align-middle shadow-xl transition-all">
                                    <div className="flex items-center justify-between">
                                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                                            Menu
                                        </Dialog.Title>
                                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full text-light-gray hover:bg-primary">
                                            <FaTimes />
                                        </button>
                                    </div>
                                    <div className="mt-8">
                                        <NavigationLinks isMobile={true} />
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-border-color space-y-4">
                                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="secondary" className="w-full">Login</Button>
                                        </Link>
                                        <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="primary" className="w-full">Get Started</Button>
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