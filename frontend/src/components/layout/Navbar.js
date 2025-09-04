// src/components/layout/Navbar.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Features', path: '#features' },
        { name: 'Pricing', path: '#pricing' }, // Assuming you'll add a pricing section
        { name: 'Testimonials', path: '#testimonials' },
    ];

    // Smooth scroll for anchor links
    const handleAnchorClick = (e, path) => {
        if (path.startsWith('#')) {
            e.preventDefault();
            const targetId = path.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-primary/80 backdrop-blur-lg border-b border-border-color' : 'bg-transparent'}`}>
            <div className="container mx-auto px-4 flex items-center justify-between h-20">
                {/* Logo */}
                <Link to="/" className="flex items-center space-x-2">
                    <img src="/app.png" alt="QuantumLeap Logo" className="h-8 w-8" />
                    <span className="text-white text-xl font-bold">QuantumLeap</span>
                </Link>

                {/* Desktop Navigation Links */}
                <div className="hidden md:flex items-center space-x-8">
                    {navLinks.map(link => (
                        <a
                            key={link.name}
                            href={link.path}
                            onClick={(e) => handleAnchorClick(e, link.path)}
                            className="text-light-gray hover:text-accent transition-colors"
                        >
                            {link.name}
                        </a>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                    <Link to="/login">
                        <Button variant="secondary" className="hidden sm:flex">Login</Button>
                    </Link>
                    <Link to="/register">
                        <Button variant="primary">Get Started</Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;