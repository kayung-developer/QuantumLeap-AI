// src/pages/ContactPage.js

import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { submitContactForm } from '../api/apiService';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Textarea from '../components/common/Textarea';
import Button from '../components/common/Button';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form'; // Using react-hook-form for better validation
import { FaEnvelope, FaQuestionCircle, FaHandshake } from 'react-icons/fa';

const ContactPage = () => {
    const { register, handleSubmit, formState: { errors }, reset } = useForm();

    const mutation = useMutation({
        mutationFn: submitContactForm,
        onSuccess: () => {
            toast.success("Your message has been sent! We'll get back to you shortly.");
            reset(); // Clear the form
        },
        onError: (err) => {
            toast.error(err.response?.data?.detail || "An error occurred. Please try again.");
        }
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    return (
        <div className="bg-primary text-white">
            <Navbar />
            <main className="container mx-auto px-4 py-24 md:py-32">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Get In Touch</h1>
                    <p className="text-lg text-light-gray">We'd love to hear from you. Whether you have a question, feedback, or a partnership inquiry, our team is ready to help.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
                    <Card>
                        <h2 className="text-2xl font-bold text-white mb-4">Send Us a Message</h2>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <Input label="Your Name" {...register("name", { required: "Name is required." })} error={errors.name} />
                            <Input label="Your Email" type="email" {...register("email", { required: "Email is required." })} error={errors.email} />
                            <Textarea label="Your Message" {...register("message", { required: "Message is required." })} error={errors.message} />
                            <Button type="submit" isLoading={mutation.isLoading} className="w-full">Send Message</Button>
                        </form>
                    </Card>

                    <div className="space-y-6">
                        <div className="space-y-6">
                        <Card className="flex items-start p-6">
                            <FaQuestionCircle className="text-3xl text-accent mr-4 mt-1 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-white">General Support</h3>
                                <p className="text-light-gray">For general questions and support, please email us directly.</p>
                                <a href="mailto:support@quantumleap.ai" className="text-accent font-semibold hover:underline break-all">support@quantumleap.ai</a>
                            </div>
                        </Card>
                         <Card className="flex items-start p-6">
                            <FaHandshake className="text-3xl text-accent mr-4 mt-1 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-white">Partnerships & Business</h3>
                                <p className="text-light-gray">For business inquiries and partnership opportunities.</p>
                                <a href="mailto:partners@quantumleap.ai" className="text-accent font-semibold hover:underline break-all">partners@quantumleap.ai</a>
                            </div>
                        </Card>
                    </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};
export default ContactPage;