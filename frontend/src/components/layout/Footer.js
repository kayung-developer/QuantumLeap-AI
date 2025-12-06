// src/components/layout/Footer.js

import React from 'react';
import { FaTwitter, FaLinkedin, FaGithub } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Footer = () => {
    const socialLinks = [
        { icon: <FaTwitter />, href: 'https://twitter.com' },
        { icon: <FaLinkedin />, href: 'https://linkedin.com' },
        { icon: <FaGithub />, href: 'https://linkedin.com' },
    ];

    const footerLinks = [
        { name: 'Terms of Service', href: 'terms' },
        { name: 'Privacy Policy', href: 'privacy' },
        { name: 'Contact Us', href: 'mailto:support@quantumleap.ai' },
    ];

    return (
        <footer className="bg-secondary border-t border-border-color">
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center space-x-2 mb-4 md:mb-0">
                        <img src="/app.png" alt="QuantumLeap Logo" className="h-8 w-8" />
                        <span className="text-white text-lg font-bold">QuantumLeap AI</span>
                    </div>

                    <div className="flex space-x-6 mb-4 md:mb-0">
                        {footerLinks.map(link => (
                            // Change text-light-gray to text-gray-600
                            <a key={link.name} href={link.href} className="text-gray-600 hover:text-accent dark:text-light-gray transition-colors font-medium">
                                {link.name}
                            </a>
                        ))}
                    </div>

                    <div className="flex space-x-6">
                        {socialLinks.map((link, index) => (
                            // Change text-light-gray to text-gray-500
                            <a key={index} href={link.href} className="text-gray-500 hover:text-accent dark:text-light-gray transition-colors text-2xl">
                                {link.icon}
                            </a>
                        ))}
                    </div>
                </div>
                {/* Copyright text */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-600 mt-8 border-t border-gray-200 dark:border-border-color pt-6 font-medium">
                    &copy; {new Date().getFullYear()} Slogan Technologies Limited. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;