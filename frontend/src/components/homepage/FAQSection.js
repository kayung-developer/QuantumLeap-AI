import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown } from 'react-icons/fa';

const faqs = [
  { q: "Is QuantumLeap suitable for beginners?", a: "Absolutely. With our Visual Strategy Builder, no-code tools, and the ability to clone strategies from the marketplace, beginners can get started with algorithmic trading in a safe and intuitive environment." },
  { q: "What exchanges are supported?", a: "We support all major exchanges, including Binance, KuCoin, and Bybit for both spot and futures trading. Our fault-tolerant data system ensures you always have a reliable connection." },
  { q: "Are my API keys and funds safe?", a: "Security is our top priority. Your API keys are encrypted at rest and in transit. We never have withdrawal permissions, and our custodial wallet uses industry-leading security provided by BitGo." },
  { q: "Can I cancel my subscription anytime?", a: "Yes. You can manage, upgrade, or cancel your subscription at any time from your billing page. Your plan will remain active until the end of the current billing period." },
];

const AccordionItem = ({ q, a }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-light-border dark:border-border-color">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left py-4 flex justify-between items-center group">
                {/* Question: Black */}
                <span className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-accent transition-colors">{q}</span>
                <FaChevronDown className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : 'text-gray-400'}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        {/* Answer: Dark Gray */}
                        <p className="pb-4 text-gray-700 dark:text-light-gray leading-relaxed">{a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FAQSection = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white text-center">Frequently Asked Questions</h2>
        <div className="mt-8">
          {faqs.map((faq, index) => <AccordionItem key={index} q={faq.q} a={faq.a} />)}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;