import React from "react";
import Navbar from "@/components/landing-page/nav-bar";
import Footer from "@/components/landing-page/footer";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        {/* Main Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-primary mb-4">
            Privacy Policy
          </h1>
          <div className="w-24 h-1 bg-primary mx-auto"></div>
        </div>
        
        <div className="prose prose-lg max-w-none">
          
          <div className="space-y-8">
            <section>
              <p className="text-muted-foreground leading-relaxed">
                At Fintr, we respect your privacy and are committed to protecting your personal information. 
                This policy explains what data we collect, how we use it, how we store it securely, and the rights you have regarding your data. 
                By using Fintr, you agree to this Privacy Policy and our Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Data We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We only collect information necessary to provide and improve Fintr:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  <strong>Personal identification data:</strong> Name, email, and account credentials.
                </li>
                <li>
                  <strong>Financial input data:</strong> Expenses, budgets, or notes you log manually or through receipt scanning.
                </li>
                <li>
                  <strong>Device and usage data:</strong> IP address, device type, browser, and interactions with Fintr to help improve performance and detect abuse.
                </li>
                <li>
                  <strong>Optional information:</strong> If you contact support or complete surveys, we collect what you choose to share.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We do not connect to your bank accounts or collect login details for financial institutions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                How We Use Your Data
              </h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  <strong>Provide services:</strong> To create your account, process inputs, deliver AI insights, and offer support.
                </li>
                <li>
                  <strong>Improve services:</strong> For analytics, testing, and feature development.
                </li>
                <li>
                  <strong>Security and compliance:</strong> To detect fraud, protect against misuse, and comply with legal obligations.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                How We Store and Protect Data
              </h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  Data is stored on secure, encrypted third-party servers.
                </li>
                <li>
                  We apply technical, organizational, and administrative safeguards to prevent unauthorized access, loss, or misuse.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                How We Share Data
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We share personal data only as needed to run Fintr:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  <strong>Service providers:</strong> Hosting, analytics, customer support, AI processing.
                </li>
                <li>
                  <strong>Legal reasons:</strong> If required by law, court order, or to protect rights, property, or safety.
                </li>
                <li>
                  <strong>Business transfers:</strong> If Fintr undergoes a merger, acquisition, or sale, your data may be transferred under the same privacy commitments.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Your Privacy Rights
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  <strong>Access:</strong> Request copies of your personal data.
                </li>
                <li>
                  <strong>Correction:</strong> Request updates to inaccurate information.
                </li>
                <li>
                  <strong>Deletion:</strong> Request we erase your personal data, subject to legal or operational requirements.
                </li>
                <li>
                  <strong>Restrict processing:</strong> Limit how we use your data in certain cases.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Requests can be made by contacting hello@fintr.ai. We will verify your identity before processing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Data Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your data only as long as needed to provide services or meet legal obligations. 
                We may retain aggregated or anonymized data that cannot identify you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this policy and publish revised versions. If significant changes occur, 
                we will notify you by email or through our app. Continued use of Fintr means you accept the revised policy.
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

export default PrivacyPolicyPage;
