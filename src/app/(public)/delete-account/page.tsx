import React from "react";
import Navbar from "@/components/landing-page/nav-bar";
import Footer from "@/components/landing-page/footer";

const DeleteAccountPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-primary mb-4">
            Delete Your Account
          </h1>
          <div className="w-24 h-1 bg-primary mx-auto"></div>
        </div>

        <div className="prose prose-lg max-w-none">
          <div className="space-y-8">
            <section>
              <p className="text-muted-foreground leading-relaxed">
                At <strong>Fintr</strong>, we respect your right to control your
                personal data. If you wish to delete your account and all
                associated data, please follow the steps below. This page is
                provided in accordance with Google Play&apos;s data deletion
                requirements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                How to Request Account Deletion
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You can request the deletion of your Fintr account using any of
                the following methods:
              </p>

              <div className="space-y-6">
                <div className="bg-muted/40 border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Option 1: Delete from the App
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                    <li>Open the Fintr app and sign in to your account.</li>
                    <li>
                      Tap the <strong>Menu</strong> icon in the bottom
                      navigation bar.
                    </li>
                    <li>
                      Go to <strong>App Settings</strong>.
                    </li>
                    <li>
                      Scroll down and tap <strong>Delete Account</strong>.
                    </li>
                    <li>
                      Confirm the deletion when prompted. Your account and data
                      will be scheduled for permanent removal.
                    </li>
                  </ol>
                </div>

                <div className="bg-muted/40 border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Option 2: Request via Email
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    If you are unable to access the app, you may submit a
                    deletion request by emailing us directly:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                    <li>
                      Send an email to{" "}
                      <a
                        href="mailto:hello@fintr.ai"
                        className="text-primary underline hover:text-primary/80 transition-colors"
                      >
                        hello@fintr.ai
                      </a>
                    </li>
                    <li>
                      Use the subject line:{" "}
                      <strong>Account Deletion Request</strong>
                    </li>
                    <li>
                      Include the email address associated with your Fintr
                      account.
                    </li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    We will verify your identity and process your request within{" "}
                    <strong>7 business days</strong>.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                What Data Is Deleted
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Upon account deletion, the following data will be{" "}
                <strong>permanently removed</strong>:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Your profile information (name, email, photo)</li>
                <li>
                  All financial data you have entered (transactions, budgets,
                  goals, loans, investments)
                </li>
                <li>Your spaces and space memberships</li>
                <li>AI chat history and generated insights</li>
                <li>Receipt images and scanned data</li>
                <li>App preferences and notification settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Deletion Timeline
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-muted-foreground border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-muted/60 text-foreground">
                      <th className="text-left px-4 py-3 font-semibold border-b border-border">
                        Action
                      </th>
                      <th className="text-left px-4 py-3 font-semibold border-b border-border">
                        Timeline
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3">
                        Account deactivated (login disabled)
                      </td>
                      <td className="px-4 py-3">Immediately upon request</td>
                    </tr>
                    <tr className="bg-muted/20">
                      <td className="px-4 py-3">
                        All personal data and financial records permanently deleted
                      </td>
                      <td className="px-4 py-3">Within 7 business days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Need Help?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about the deletion process or your data,
                please contact us at{" "}
                <a
                  href="mailto:hello@fintr.ai"
                  className="text-primary underline hover:text-primary/80 transition-colors"
                >
                  hello@fintr.ai
                </a>
                . We are committed to handling your request promptly and
                transparently.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Last updated:{" "}
              {new Date("2026-03-27").toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DeleteAccountPage;
