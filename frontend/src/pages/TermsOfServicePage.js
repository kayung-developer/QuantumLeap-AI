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

const TermsOfServicePage = () => {
    return (
        <div className="bg-primary text-white">
            <Navbar />
            <main className="container mx-auto px-4 py-24 md:py-32">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white text-center mb-4">Terms of Service</h1>
                    <p className="text-center text-light-gray mb-12">Last Updated: August 26, 2025</p>

                    <Section title="1. Acceptance of Terms">
                        <p>Welcome to QuantumLeap AI Trader ("the Service"), a software-as-a-service platform provided by Slogan Technologies LLC ("the Company", "we", "us", "our"). By accessing or using our Service, you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, you may not use the Service.</p>
                    </Section>

                    <Section title="2. Description of Service">
                        <p>QuantumLeap AI Trader provides users with tools to create, backtest, and deploy automated trading bots that interact with third-party cryptocurrency exchanges via API keys. The Service also includes market analysis tools, a strategy marketplace, and other related features. The Service does not provide financial advice, brokerage services, or custody of your funds on external exchanges.</p>
                    </Section>

                    <Section title="3. Financial Risk Disclaimer">
                        <p><strong>Trading cryptocurrencies is highly speculative and involves a significant risk of loss. The Service is a tool for automation and does not guarantee profits or protect against losses. All trading decisions and their outcomes are solely your responsibility. Slogan Technologies LLC is not a financial advisor. You should consult with a qualified financial professional before making any investment decisions. We are not liable for any financial losses you may incur as a result of using the Service.</strong></p>
                    </Section>

                    <Section title="4. User Accounts and Responsibilities">
                        <p>You are responsible for maintaining the confidentiality of your account credentials, including your password and any API keys you connect to the Service. You agree to notify us immediately of any unauthorized use of your account. You are solely responsible for all activities that occur under your account.</p>
                    </Section>

                    <Section title="5. User Conduct">
                        <p>You agree not to use the Service to: (a) engage in any fraudulent, manipulative, or illegal activity; (b) reverse-engineer, decompile, or otherwise attempt to discover the source code of the Service; (c) use the Service to build a competitive product; (d) share your account with others; (e) upload or transmit any malicious code or viruses.</p>
                    </Section>

                    <Section title="6. Subscriptions and Payments">
                        <p>The Service is offered under various subscription plans. By selecting a paid plan, you agree to pay the specified fees. Fees are billed in advance on a recurring basis and are non-refundable except as required by law. We reserve the right to change our subscription fees upon 30 days' notice.</p>
                    </Section>

                    <Section title="7. Intellectual Property">
                        <p>All rights, title, and interest in and to the Service (excluding user-provided content and strategies) are and will remain the exclusive property of Slogan Technologies LLC. You may not copy, modify, or distribute any part of the Service without our express written permission.</p>
                    </Section>

                    <Section title="8. Limitation of Liability">
                        <p>To the maximum extent permitted by law, Slogan Technologies LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to, loss of profits, data, or goodwill, arising from your use of the Service or any trading losses incurred.</p>
                    </Section>

                    <Section title="9. Termination">
                        <p>We may terminate or suspend your access to the Service at any time, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease.</p>
                    </Section>

                    <Section title="10. Governing Law">
                        <p>These Terms shall be governed by the laws of the jurisdiction in which Slogan Technologies LLC is registered, without regard to its conflict of law provisions.</p>
                    </Section>

                    <Section title="11. Changes to Terms">
                        <p>We reserve the right to modify these Terms at any time. We will provide notice of material changes by updating the "Last Updated" date. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.</p>
                    </Section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default TermsOfServicePage;