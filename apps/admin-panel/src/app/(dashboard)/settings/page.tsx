import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { Save } from "lucide-react";
import { updatePlatformSettings } from "./actions";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdmin();

  const settings = await db.platformSetting.findMany();
  
  const getSetting = (key: string, defaultVal: string) => {
    return settings.find(s => s.key === key)?.value || defaultVal;
  };

  const commissionPct = getSetting("COMMISSION_PCT", "30");
  const defaultClassDuration = getSetting("DEFAULT_CLASS_DURATION_MIN", "60");
  const teacherMembershipFee = getSetting("TEACHER_MEMBERSHIP_FEE", "99900");

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Platform Settings</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Settings</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Global Settings</h2>
            
            <form action={updatePlatformSettings} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">LM Commission Percentage (%)</label>
                  <p className="text-xs text-gray-500 mb-2">The default cut taken from all teacher bookings.</p>
                  <input 
                    required 
                    type="number" 
                    name="commissionPct" 
                    defaultValue={commissionPct} 
                    className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Teacher Membership Fee (paise)</label>
                  <p className="text-xs text-gray-500 mb-2">The fee charged for teachers to join the platform.</p>
                  <input 
                    required 
                    type="number" 
                    name="teacherMembershipFee" 
                    defaultValue={teacherMembershipFee} 
                    className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Default Class Duration (minutes)</label>
                  <input 
                    required 
                    type="number" 
                    name="defaultClassDuration" 
                    defaultValue={defaultClassDuration} 
                    className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" 
                  />
                </div>
              </div>
              
              <button type="submit" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-6 rounded text-sm transition-colors mt-2">
                <Save size={16} /> Save Settings
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6 opacity-70">
            <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Payment Gateways</h2>
            <p className="text-sm text-gray-400 mb-4">Integrations to be configured in Phase 2.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
                <span className="text-sm text-white">Razorpay</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">Pending</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
                <span className="text-sm text-white">Stripe</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
