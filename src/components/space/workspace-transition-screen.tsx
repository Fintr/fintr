"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface WorkspaceTransitionScreenProps {
  isVisible: boolean;
  workspaceName?: string;
  isOrganization?: boolean;
}

export function WorkspaceTransitionScreen({
  isVisible,
  workspaceName,
  isOrganization = false,
}: WorkspaceTransitionScreenProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      console.log('🎬 Workspace transition starting:', workspaceName);
      setShow(true);
    } else {
      console.log('🎬 Workspace transition ending');
      // Delay hiding to allow slide-out animation
      const timer = setTimeout(() => setShow(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, workspaceName]);

  if (!show) {
    return null;
  }

  console.log('🎨 Rendering workspace transition overlay:', { isVisible, workspaceName });

  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex items-center justify-center
        bg-background
        transition-transform duration-500 ease-out
        ${isVisible ? 'translate-x-0' : 'translate-x-full'}
      `}
      style={{
        transformOrigin: 'right',
      }}
    >
      {/* Main content container with slide animation */}
      <div
        className={`
          relative z-10 text-center px-6
          transition-all duration-700 ease-out
          ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}
        `}
      >
        {/* Fintr Logo with pulsating animation */}
        <div className="mb-[50px] flex justify-center">
          <div className="relative">
            {/* Logo */}
            <div className="relative animate-pulse-logo">
              <Image
                src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
                alt="Fintr Logo"
                width={120}
                height={120}
                className="drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>

        {/* Text content with staggered slide-in */}
        <div className="space-y-4">
          <div
            className={`
              transition-all duration-700 ease-out
              ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}
            `}
            style={{ transitionDelay: '100ms' }}
          >
            <h2 className="text-xl md:text-2xl text-primary">
              Switching to
            </h2>
          </div>
          
          <div
            className={`
              transition-all duration-700 ease-out
              ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}
            `}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="backdrop-blur-sm rounded-2xl px-8 pb-5 inline-block">
              <p className="text-2xl md:text-3xl font-bold text-primary">
                {workspaceName || 'Workspace'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.4;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }

        @keyframes pulse-logo {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .animate-pulse-ring {
          animation: pulse-ring 2s ease-in-out infinite;
        }

        .animate-pulse-logo {
          animation: pulse-logo 2s ease-in-out infinite;
        }

        .animation-delay-300 {
          animation-delay: 0.3s;
        }
      `}</style>
    </div>
  );
}
