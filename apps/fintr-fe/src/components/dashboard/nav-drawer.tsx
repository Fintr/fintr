import React from 'react';
import { X, User, Settings, LogOut } from 'lucide-react';
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { SpaceSwitcher } from "@/components/space/space-switcher";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  navItems: NavItem[];
  isMobile?: boolean;
  showSpaceSwitcher?: boolean;
}

const NavDrawer: React.FC<NavDrawerProps> = ({ 
  open, 
  onClose, 
  onLogout, 
  navItems, 
  isMobile = true,
  showSpaceSwitcher = true 
}) => {
  const { user } = useAuth();

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-80 max-w-full bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ willChange: 'transform' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Single close button */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-primary focus:outline-none"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="h-6 w-6" />
        </button>
        <div className={`${isMobile ? 'pt-12' : 'pt-4'} px-6 pb-6 flex flex-col gap-4 h-full overflow-y-auto`}>
          {/* Menu header */}
          <h3 className="text-lg font-semibold mb-2">{isMobile ? 'Menu' : 'Account'}</h3>
          
          {/* Space Switcher Section */}
          <SpaceSwitcher 
            showSpaceSwitcher={showSpaceSwitcher} 
            isMobile={isMobile} 
          />
          
          {/* User Info */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              className="flex items-center gap-2 w-full text-left font-semibold text-primary py-2 px-2 rounded hover:bg-gray-100 focus:outline-none"
              onClick={() => {}}
              aria-expanded={true}
              aria-controls="account-menu"
            >
              <User className="h-5 w-5 mr-2" />
              {user?.name || "User"}
            </button>
            
            {/* Navigation Items */}
            <div
              id="account-menu"
              className="overflow-visible transition-none max-h-full opacity-100"
              style={{ pointerEvents: 'auto' }}
            >
              {navItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 text-primary w-full"
                  onClick={onClose}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.title}
                </Link>
              ))}
              
              {/* Logout */}
              <button 
                className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 text-primary w-full" 
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </aside>

    </>
  );
};

export default NavDrawer; 
