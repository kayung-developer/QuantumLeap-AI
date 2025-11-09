import React from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const Section = ({ title, children }) => (
    <section className="mb-8">
        <h2 className="text-2xl font-bold text-accent mb-3">{title}</h2>
        <div className="space-y-4 text-light-gray leading-relaxed">
            {children}
        </div>
    </section>
);

const PrivacyPolicyPage = () => {
    return (
        <div className="bg-primary text-white">
            <Navbar />
            <main className="container mx-auto px-4 py-24 md:py-32">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white text-center mb-4">Privacy Policy</h1>
                    <p className="text-center text-light-gray mb-12">Last Updated: August 26, 2025</p>

                    <Section title="Introduction">
                        <p>Slogan Technologies LLC ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use QuantumLeap AI Trader ("the Service").</p>
                    </Section>

                    <Section title="Information We Collect">
                        <p>We may collect information about you in a variety of ways:</p>
                        <ul className="list-disc list-inside space-y-2 pl-4">
                            <li><strong>Personal Data:</strong> We collect personally identifiable information, such as your name, email address, and payment information, when you register and subscribe to our Service.</li>
                            <li><strong>Exchange API Keys:</strong> To provide the trading bot functionality, we require you to provide API keys for your third-party exchange accounts. These keys are immediately encrypted upon submission and stored in our secure database. We only ever decrypt them in memory to execute your configured trading operations.</li>
                            <li><strong>Usage Data:</strong> We automatically collect information about how you interact with the Service, such as your IP address, browser type, pages visited, and bot configurations.</li>
                            <li><strong>Trade Data:</strong> We may store a log of the trades executed by your bots for performance tracking and display within your dashboard.</li>
                        </ul>
                    </Section>

                    <Section title="How We Use Your Information">
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc list-inside space-y-2 pl-4">
                            <li>Create and manage your account.</li>
                            <li>Provide, operate, and maintain the Service.</li>
                            <li>Process your subscription payments.</li>
                            <li>Communicate with you, including sending service updates and marketing materials (from which you can opt-out).</li>
                            <li>Improve the Service and analyze usage trends.</li>
                            <li>Monitor for and prevent fraudulent or unauthorized activity.</li>
                        </ul>
                    </Section>

                    <Section title="Data Security">
                        <p>We implement a variety of security measures to maintain the safety of your personal information. All sensitive information you supply, particularly API keys, is encrypted via Transport Layer Security (TLS) technology and further encrypted at rest in our databases using industry-standard encryption. Access to this data is strictly limited to authorized personnel.</p>
                    </Section>

                    <Section title="Data Sharing and Disclosure">
                        <p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties except in the following circumstances:</p>
                        <ul className="list-disc list-inside space-y-2 pl-4">
                            <li>With trusted third-party service providers who assist us in operating our Service (e.g., payment processors like Stripe/PayPal, cloud hosting providers like AWS/Google Cloud), so long as those parties agree to keep this information confidential.</li>
                            <li>To comply with legal obligations, enforce our site policies, or protect our or others' rights, property, or safety.</li>
                        </ul>
                    </Section>

                     <Section title="Your Data Rights">
                        <p>Depending on your jurisdiction, you may have rights regarding your personal data, including the right to access, correct, or request the deletion of your data. You can manage your profile information directly from your account settings. For other requests, please contact us.</p>
                    </Section>

                    <Section title="Contact Us">
                        <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@quantumleap.ai" className="text-accent underline">privacy@quantumleap.ai</a>.</p>
                    </Section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default PrivacyPolicyPage;