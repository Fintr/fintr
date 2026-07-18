import React from "react";
import { Check } from "lucide-react";
import Navbar from "@/components/landing-page/nav-bar";
import Footer from "@/components/landing-page/footer";

const Pricing = () => {
  return (
    <div className="w-full min-h-screen bg-background">
      <Navbar />
      <main className="pb-16 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <section className="py-16 md:py-24 bg-[#F7F2E7] rounded-2xl">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
                Pricing
              </h2>
              <p className="text-lg text-primary leading-relaxed">
                Simple, transparent pricing for everyone
              </p>
            </div>

            <div className="max-w-5xl mx-auto">
              <div className="bg-[#f9f7f5] rounded-2xl overflow-hidden shadow-lg">
                <div className="bg-primary text-white p-8 text-center">
                  <h3 className="text-2xl font-bold mb-2">Core Features</h3>
                  <div className="flex items-center justify-center">
                    <span className="text-4xl font-bold">
                      Pricing. Simplified. Soon.
                    </span>
                  </div>
                </div>

                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-lg mb-4 text-primary">
                        What's included:
                      </h4>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-primary">Goal Setting</span>
                        </li>
                        <li className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-primary">
                            Expense & Income Tracker
                          </span>
                        </li>
                        <li className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-primary">Loan Tracker</span>
                        </li>
                        <li className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-primary">Budget Tracker</span>
                        </li>
                        <li className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-primary">
                            Basic Chatbot (Limited Prompts)
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-lg mb-4 text-primary">
                        Coming soon (Premium):
                      </h4>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <span className="text-[#3D8D7F] mr-2 mt-0.5 flex-shrink-0 font-bold">
                            +
                          </span>
                          <span className="text-primary">
                            Advanced Chatbot Features
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-[#3D8D7F] mr-2 mt-0.5 flex-shrink-0 font-bold">
                            +
                          </span>
                          <span className="text-primary">
                            AI Agent (Create Tasks Automatically)
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-[#3D8D7F] mr-2 mt-0.5 flex-shrink-0 font-bold">
                            +
                          </span>
                          <span className="text-primary">
                            Receipt Scanner with Image Recognition
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-[#3D8D7F] mr-2 mt-0.5 flex-shrink-0 font-bold">
                            +
                          </span>
                          <span className="text-primary">
                            Advanced Analytics & Insights
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-[#3D8D7F] mr-2 mt-0.5 flex-shrink-0 font-bold">
                            +
                          </span>
                          <span className="text-primary">
                            Investment Tracking & Forecasting
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
