import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, RefreshCcw, Mail } from 'lucide-react';

const Legal = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const path = location.pathname;

    let content = {};

    if (path === '/privacy') {
        content = {
            title: 'Privacy Policy',
            icon: <ShieldCheck className="w-8 h-8 text-primary" />,
            text: `
                **Privacy Policy for BudgetTracker Pro**
                
                Effective Date: 01-Jun-2026

                **1. Information We Collect**
                We collect information you provide directly to us, such as your name, email address, and financial data (budgets, transactions) that you input into the app. When using Razorpay for payments, your payment details are handled securely by Razorpay and not stored on our servers.

                **2. How We Use Information**
                We use the information to provide, maintain, and improve our services, securely store your financial data across devices, and communicate with you about your account.

                **3. Information Sharing**
                We do not sell or share your personal information with third parties, except for essential service providers like Google Firebase (for database storage) and Razorpay (for secure payments).

                **4. Security**
                We take reasonable measures to help protect your information from loss, theft, misuse, and unauthorized access. All database interactions are secured via authenticated tokens.

                **5. Contact Us**
                If you have any questions about this Privacy Policy, please contact us at support@budgettracker.app.
            `
        };
    } else if (path === '/terms') {
        content = {
            title: 'Terms & Conditions',
            icon: <FileText className="w-8 h-8 text-primary" />,
            text: `
                **Terms and Conditions for BudgetTracker Pro**
                
                Effective Date: 01-Jun-2026

                **1. Acceptance of Terms**
                By accessing and using BudgetTracker Pro, you accept and agree to be bound by the terms and provision of this agreement.

                **2. Description of Service**
                BudgetTracker Pro provides personal finance tracking tools. The service is provided "as is" and we are not responsible for any financial losses or miscalculations resulting from the use of our software.

                **3. User Conduct**
                You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.

                **4. Subscriptions and Payments**
                Premium features ("Pro Subscription") require a one-time or recurring payment processed via our secure payment partner, Razorpay. 

                **5. Modifications to Service**
                We reserve the right to modify or discontinue the service with or without notice.
            `
        };
    } else if (path === '/refund') {
        content = {
            title: 'Cancellation & Refund Policy',
            icon: <RefreshCcw className="w-8 h-8 text-primary" />,
            text: `
                **Cancellation & Refund Policy**
                
                Effective Date: 01-Jun-2026

                **1. Cancellation**
                You may cancel your Pro subscription at any time. Cancellation will take effect at the end of the current billing cycle. You will retain access to the Pro features until that time.

                **2. Refunds**
                We offer a 7-day money-back guarantee for initial subscription purchases. If you are not satisfied with BudgetTracker Pro within the first 7 days of your purchase, you may request a full refund. 

                **3. Process**
                To request a refund, please contact us at support@budgettracker.app with your account email and Razorpay payment ID. Refunds will be processed within 5-7 business days to the original payment method.

                **4. Exceptions**
                No refunds are provided for partial months or after the 7-day initial period.
            `
        };
    } else if (path === '/shipping') {
        content = {
            title: 'Shipping & Delivery Policy',
            icon: <FileText className="w-8 h-8 text-primary" />,
            text: `
                **Shipping & Delivery Policy**
                
                Effective Date: 01-Jun-2026

                **1. Digital Delivery**
                BudgetTracker Pro is a purely digital software service. We do not sell or ship physical goods.

                **2. Access to Services**
                Upon successful completion of payment, your account will be instantly upgraded to "Pro" status. The delivery of our premium features is immediate and automatic.

                **3. Confirmation**
                You will receive a confirmation email and a payment receipt from our payment gateway partner (Razorpay) as proof of purchase and successful delivery of digital services.
            `
        };
    } else if (path === '/contact') {
        content = {
            title: 'Contact Us',
            icon: <Mail className="w-8 h-8 text-primary" />,
            text: `
                **Contact Us**
                
                We'd love to hear from you! If you have any questions, feedback, or need support with your account, please reach out to our team.

                **Email Support:**
                support@budgettracker.app

                **Phone Support:**
                +91 9876543210 (Mon - Fri, 9 AM - 5 PM IST)

                **Mailing Address:**
                BudgetTracker Technologies,
                123 Innovation Drive, 
                Tech Park, Chennai, TN, 600001, India.

                *We aim to respond to all inquiries within 24 hours.*
            `
        };
    } else {
        content = {
            title: 'Legal',
            icon: <FileText className="w-8 h-8 text-primary" />,
            text: 'Content not found.'
        };
    }

    // Convert newlines to paragraphs
    const paragraphs = content.text.split('\n\n').filter(p => p.trim() !== '');

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3">
                    {content.icon}
                    <h1 className="text-xl font-bold">{content.title}</h1>
                </div>
            </header>
            <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                    {paragraphs.map((p, i) => {
                        if (p.trim().startsWith('**')) {
                            const titleMatch = p.match(/\*\*(.*?)\*\*/);
                            const text = p.replace(/\*\*(.*?)\*\*/, '');
                            return (
                                <div key={i} className="mb-6">
                                    <h2 className="text-lg font-bold text-primary mb-2">{titleMatch && titleMatch[1]}</h2>
                                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{text.trim()}</p>
                                </div>
                            );
                        }
                        return <p key={i} className="mb-4 text-muted-foreground leading-relaxed whitespace-pre-line">{p.trim()}</p>;
                    })}
                </div>
            </main>
            <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border mt-auto">
                &copy; {new Date().getFullYear()} BudgetTracker Pro. All rights reserved.
            </footer>
        </div>
    );
};

export default Legal;
