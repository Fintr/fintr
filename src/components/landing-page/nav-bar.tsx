"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, X, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth0 } from "@auth0/auth0-react";

interface NavbarProps {
  logoSrc?: string;
  companyName?: string;
}

const navLinks = [
  { name: "Core Features", href: "/#core-features" },
  { name: "What's Next", href: "/whats-next" },
  { name: "Discover", href: "/discover" },
  { name: "Contact Us", href: "/contact-us" },
  { name: "Pricing", href: "/pricing" },
];

const Navbar = ({}: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ text: string; isUser: boolean }[]>(
    []
  );
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { loginWithRedirect } = useAuth0();

  const toggleChatbot = () => {
    // Instead of opening the navbar chatbot, trigger the floating chatbot widget
    const chatbotWidget = document.getElementById("chatbot-widget-button");
    if (chatbotWidget) {
      chatbotWidget.click();
    }
  };

  const handleSendMessage = () => {
    if (message.trim() === "") return;

    // Add user message
    setMessages([...messages, { text: message, isUser: true }]);
    setIsTyping(true);

    // Process the message
    const userMessage = message.toLowerCase();
    setMessage("");

    // Simulate typing delay
    setTimeout(() => {
      let botResponse = "";
      let section = "";

      // Simple routing logic based on keywords
      if (
        userMessage.includes("pricing") ||
        userMessage.includes("cost") ||
        userMessage.includes("price")
      ) {
        botResponse =
          "You can find our pricing information in the Pricing section. Would you like me to take you there?";
        section = "pricing";
      } else if (
        userMessage.includes("feature") ||
        userMessage.includes("what can you do")
      ) {
        botResponse =
          "Fintr offers various features like expense tracking, budgeting, and AI-powered insights. Check out our Core Features section for more details.";
        section = "core-features";
      } else if (
        userMessage.includes("coming") ||
        userMessage.includes("future") ||
        userMessage.includes("next")
      ) {
        botResponse =
          "We have exciting features coming soon! Visit our What's Next section to learn more.";
        section = "whats-next";
      } else if (
        userMessage.includes("how") ||
        userMessage.includes("tutorial") ||
        userMessage.includes("learn")
      ) {
        botResponse =
          "You can learn how to use Fintr in our Discover section with tutorials and FAQs.";
        section = "how-to-use";
      } else if (
        userMessage.includes("job") ||
        userMessage.includes("career") ||
        userMessage.includes("work")
      ) {
        botResponse =
          "We're hiring! Check out the Work with Fintr tab in our Discover section for open positions.";
        section = "how-to-use";
      } else if (
        userMessage.includes("waitlist") ||
        userMessage.includes("sign up") ||
        userMessage.includes("join")
      ) {
        botResponse =
          "You can join our waitlist by clicking the 'Join Waitlist' button in the hero section or pricing section.";
      } else {
        botResponse =
          "I'm here to help you navigate Fintr. You can ask about our features, pricing, or how to use the app. Is there something specific you'd like to know?";
      }

      setMessages((prev) => [...prev, { text: botResponse, isUser: false }]);
      setIsTyping(false);

      // If a section was identified and the response suggests navigation
      if (
        section &&
        botResponse.includes("Would you like me to take you there?")
      ) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              text: "I can navigate you there directly. Just click this button:",
              isUser: false,
            },
          ]);

          // Add a slight delay before adding the navigation button message
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                text: `<button class="bg-primary hover:bg-primary/80 text-white rounded-md px-4 py-2 mt-2" onclick="window.location.href='/#${section}';">Go to ${section
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}</button>`,
                isUser: false,
              },
            ]);
          }, 500);
        }, 1000);
      }
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle scroll events to minimize/expand chatbot
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      if (scrollPosition > 100 && !isScrolled) {
        setIsScrolled(true);
        if (isOpen) setIsOpen(false);
      } else if (scrollPosition <= 100 && isScrolled) {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isScrolled, isOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 bg-background z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <a href="/" className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
                alt="Logo"
                className="h-10 w-auto"
              />
            </a>
          </div>

          <div className="flex items-center justify-center relative w-full max-w-md mx-4">
            <div className="w-full relative">
              <div className="bg-white border border-gray-200 hover:border-primary rounded-full py-2 px-4 shadow-sm transition-all flex items-center w-full cursor-pointer">
                <input
                  type="text"
                  placeholder="Ask Fintr anything..."
                  className="bg-transparent border-none outline-none flex-grow text-sm text-gray-700"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={handleSendMessage}
                  className="text-primary hover:text-primary/80 bg-gray-100 rounded-full p-1.5"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="absolute top-12 bg-white rounded-lg shadow-xl w-full overflow-hidden border border-gray-200 z-50">
                <div className="bg-primary text-white p-3 flex justify-between items-center">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Fintr Assistant</h3>
                  </div>
                  <button
                    onClick={toggleChatbot}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="h-80 overflow-y-auto p-4 bg-gray-50">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-3 ${
                        msg.isUser ? "text-right" : "text-left"
                      }`}
                    >
                      <div
                        className={`inline-block rounded-lg px-4 py-2 max-w-[80%] ${
                          msg.isUser
                            ? "bg-primary text-white"
                            : "bg-white border border-gray-200 text-primary"
                        }`}
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                      ></div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="text-left mb-3">
                      <div className="inline-block rounded-lg px-4 py-2 bg-white border border-gray-200 text-primary">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.4s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-gray-200 flex">
                  <Input
                    type="text"
                    placeholder="Ask me anything..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow mr-2"
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="bg-primary hover:bg-primary/80"
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <nav className="hidden md:flex items-center space-x-4 mr-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm text-primary hover:text-primary transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </nav>
            <Button
              className="bg-primary hover:bg-primary/80 text-white rounded-md px-6 py-2"
              onClick={() => loginWithRedirect()}
            >
              Log In / Sign Up
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
