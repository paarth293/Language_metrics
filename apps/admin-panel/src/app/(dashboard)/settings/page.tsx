"use client";

import { useState } from "react";
import { Settings, Shield, Bell, User } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("General Information");

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border)",
  };

  const tabs = [
    { label: "General Information", icon: Settings },
    { label: "Security & Access", icon: Shield },
    { label: "Notifications", icon: Bell },
    { label: "Admin Profile", icon: User },
  ];

  return (
    <div className="p-8 space-y-8 pb-12 max-w-[1400px]">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ color: "var(--lm-accent)" }} className="text-3xl font-bold tracking-tight mb-1">Platform Settings</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Configure admin preferences and global platform rules.</p>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Navigation Sidebar inside Settings */}
        <div className="md:col-span-1 space-y-2">
          {tabs.map((item, i) => (
            <button 
              key={i} 
              onClick={() => setActiveTab(item.label)}
              style={activeTab === item.label ? { background: "var(--lm-surface)", border: "1px solid var(--lm-border)", color: "var(--lm-text)" } : { color: "var(--lm-text-muted)", border: "1px solid transparent" }} 
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-semibold text-left transition-colors hover:text-white"
            >
              <item.icon size={16} style={{ color: activeTab === item.label ? "var(--lm-accent)" : "inherit" }} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Settings Panel */}
        <div style={cardStyle} className="md:col-span-2 rounded-xl p-8 min-h-[400px]">
          <h2 style={{ color: "var(--lm-text)" }} className="text-[18px] font-bold mb-6 border-b border-[var(--lm-border)] pb-4">{activeTab}</h2>
          
          {activeTab === "General Information" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <label style={{ color: "var(--lm-text-subtle)" }} className="block text-[11px] font-bold uppercase tracking-wider mb-2">Platform Name</label>
                <input type="text" defaultValue="Language Matrix" disabled style={{ background: "var(--lm-bg)", border: "1px solid var(--lm-border)", color: "var(--lm-text-muted)" }} className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium cursor-not-allowed" />
              </div>
              
              <div>
                <label style={{ color: "var(--lm-text-subtle)" }} className="block text-[11px] font-bold uppercase tracking-wider mb-2">Support Email</label>
                <input type="email" defaultValue="support@languagematrix.com" style={{ background: "var(--lm-bg)", border: "1px solid var(--lm-border)", color: "var(--lm-text)" }} className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium outline-none focus:border-yellow-500/50" />
              </div>

              <div className="pt-4 flex justify-end">
                <button style={{ background: "var(--lm-accent)", color: "#000" }} className="px-6 py-2.5 rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === "Security & Access" && (
            <div className="space-y-6 max-w-lg">
              <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">Manage two-factor authentication and active sessions.</p>
              <button style={{ background: "var(--lm-bg)", border: "1px solid var(--lm-border)", color: "var(--lm-text)" }} className="w-full px-4 py-3 rounded-lg text-[13px] font-medium hover:border-yellow-500/50 transition-colors flex justify-between items-center">
                <span>Require 2FA for all Admins</span>
                <span style={{ color: "var(--lm-ok)" }} className="text-[11px] font-bold bg-green-500/10 px-2 py-1 rounded">Enabled</span>
              </button>
            </div>
          )}

          {activeTab === "Notifications" && (
            <div className="space-y-6 max-w-lg">
              <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">Configure which alerts you receive via email.</p>
              <div className="space-y-3">
                {["New Teacher Registrations", "Payout Failures", "System Updates"].map((alert) => (
                  <label key={alert} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-600 text-yellow-500 focus:ring-yellow-500 bg-gray-800" />
                    <span style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{alert}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Admin Profile" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <label style={{ color: "var(--lm-text-subtle)" }} className="block text-[11px] font-bold uppercase tracking-wider mb-2">Username</label>
                <input type="text" defaultValue="admin" disabled style={{ background: "var(--lm-bg)", border: "1px solid var(--lm-border)", color: "var(--lm-text-muted)" }} className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium cursor-not-allowed" />
              </div>
              <div className="pt-4 flex justify-end">
                <button style={{ border: "1px solid var(--lm-err)", color: "var(--lm-err)" }} className="px-6 py-2.5 rounded-lg text-[13px] font-bold hover:bg-red-500/10 transition-colors">
                  Reset Password
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
