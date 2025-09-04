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

                    <div className="flex space-x-6 text-light-gray mb-4 md:mb-0">
                        {footerLinks.map(link => (
                            <a key={link.name} href={link.href} className="hover:text-accent transition-colors">
                                {link.name}
                            </a>
                        ))}
                    </div>

                    <div className="flex space-x-6">
                        {socialLinks.map((link, index) => (
                            <a key={index} href={link.href} className="text-light-gray hover:text-accent transition-colors text-2xl">
                                {link.icon}
                            </a>
                        ))}
                    </div>
                </div>
                <div className="text-center text-sm text-light-gray mt-8 border-t border-border-color pt-6">
                    &copy; {new Date().getFullYear()} Slogan Technologies LLC. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;