import React, { useState } from 'react';
import { X, User, Settings, LogOut, Camera, Plus } from 'lucide-react';
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  onAddReceipt: () => void;
  onAddTransaction: () => void;
  onLogout: () => void;
}

const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ open, onClose, onAddReceipt, onAddTransaction, onLogout }) => {
  const [accountOpen, setAccountOpen] = useState(false);
  const { user } = useAuth0();
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
        <div className="pt-12 px-6 pb-6 flex flex-col gap-4 h-full overflow-y-auto">
          {/* Menu header */}
          <h3 className="text-lg font-semibold mb-2">Menu</h3>
          {/* Ask Fintr anything search bar */}
          {/* <div className="flex items-center bg-gray-100 p-2 rounded-lg mb-2">
            <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Ask Fintr anything"
              className="bg-transparent outline-none flex-1"
            />
          </div> */}
          {/* Add Receipt and Add Transaction buttons */}
          <button
            onClick={() => {
              onAddReceipt();
              onClose();
            }}
            className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 text-primary w-full font-medium"
          >
            <Camera className="h-4 w-4 mr-2" />
            Add Receipt
          </button>
          <button
            onClick={() => {
              onAddTransaction();
              onClose();
            }}
            className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 text-primary w-full font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </button>
          {/* Account section: only clickable John Doe with animated expandable menu */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              className="flex items-center gap-2 w-full text-left font-semibold text-primary py-2 px-2 rounded hover:bg-gray-100 focus:outline-none"
              onClick={() => setAccountOpen((v) => !v)}
              aria-expanded={accountOpen}
              aria-controls="mobile-account-menu"
            >
              <User className="h-5 w-5 mr-2" />
              {user?.name || "John Doe"}
              <span className={`ml-auto transition-transform ${accountOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>
            <div
              id="mobile-account-menu"
              className={`overflow-hidden transition-all duration-300 ease-in-out ${accountOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}
              style={{ pointerEvents: accountOpen ? 'auto' : 'none' }}
            >
              <Link href="/dashboard/settings" className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 text-primary w-full"
                onClick={onClose}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
              <button className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 text-primary w-full" onClick={onLogout}>
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

export default MobileNavDrawer; 
