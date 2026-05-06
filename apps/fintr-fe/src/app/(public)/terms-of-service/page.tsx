import React from "react";
import Navbar from "@/components/landing-page/nav-bar";
import Footer from "@/components/landing-page/footer";

const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <div className="prose prose-lg max-w-none">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-primary mb-4">
              Terms of Service
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto"></div>
          </div>
        
          <div className="space-y-8">
            <section>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to Fintr, a personal finance tracker and assistant platform based in the Philippines. 
                These Terms of Service govern your use of Fintr's website, app, and related services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By using Fintr, you confirm that you are capable of entering into a binding agreement. 
                By accessing or using Fintr, you agree to these terms and to our Privacy Policy. 
                If you do not agree, you may not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Services Provided
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Fintr lets you log expenses, set budgets, and receive AI-powered insights. 
                We do not connect to your bank accounts to protect your data. 
                Features may change without prior notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                User Conduct
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to misuse Fintr or use it for unlawful activities. 
                You must not attempt to disrupt our services, access data without authorization, 
                or share your account credentials with others.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                User Data and Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We collect information you provide to improve your experience. 
                Data is stored securely on trusted third-party servers. 
                We will not sell or share your personal information without your consent, 
                except as required by law. See our Privacy Policy for full details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Account Termination
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may suspend or terminate your account if you violate these terms, 
                harm our services, or misuse Fintr in any way.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                All content you input remains yours. You must ensure you have the right 
                to use any content you submit. Fintr respects intellectual property rights 
                and expects users to do the same.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Fair Use Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To keep Fintr reliable for all users, we enforce fair use:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  <strong>Usage limits:</strong> We may set reasonable caps on AI queries or OCR scans per user.
                </li>
                <li>
                  <strong>No automation:</strong> Bots, scrapers, or automated tools to extract data are prohibited.
                </li>
                <li>
                  <strong>No account sharing:</strong> Accounts are for individual use only.
                </li>
                <li>
                  <strong>Commercial restrictions:</strong> Using Fintr to resell data or services is prohibited without our written consent.
                </li>
                <li>
                  <strong>Monitoring:</strong> We may monitor usage and act against accounts that consistently exceed fair use.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Dispute Resolution
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Any disputes will be governed by Philippine law and resolved exclusively in Philippine courts.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Fintr is provided "as is" and "as available." We do not guarantee uninterrupted 
                or error-free service and are not liable for any direct or indirect damages 
                arising from your use of Fintr.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update these terms from time to time. Continued use of Fintr after 
                changes are posted means you accept the revised terms. We will notify you 
                of material changes via email or a notice on our website.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Last updated: {new Date('2025-08-28').toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TermsOfServicePage;
