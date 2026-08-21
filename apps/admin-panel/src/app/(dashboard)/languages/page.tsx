import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { Plus, Power, PowerOff } from "lucide-react";
import { addLanguage, toggleLanguageStatus } from "./actions";

export const dynamic = 'force-dynamic';

export default async function LanguagesPage() {
  await requireAdmin();
  const languages = await db.language.findMany({
    include: { _count: { select: { courses: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Language Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Languages</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div style={cardStyle} className="rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Language</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-center">Levels</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-center">Courses</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {languages.map((lang) => (
                    <tr key={lang.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{lang.flagEmoji}</span>
                          <div>
                            <p className="text-[13px] font-medium text-white">{lang.name}</p>
                            <p className="text-[11px] text-gray-500 uppercase">{lang.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center text-gray-300 text-sm">{lang.levels}</td>
                      <td className="py-3.5 px-5 text-center text-gray-300 text-sm">{lang._count.courses}</td>
                      <td className="py-3.5 px-5 text-right">
                        <form action={async () => {
                          "use server";
                          await toggleLanguageStatus(lang.id, lang.status);
                        }}>
                          <button type="submit" className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                            lang.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                          }`}>
                            {lang.status === 'ACTIVE' ? <Power size={12} /> : <PowerOff size={12} />}
                            {lang.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {languages.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-14 text-center text-gray-500 text-sm">No languages defined yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Language</h2>
            <form action={addLanguage} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language Name</label>
                <input required type="text" name="name" placeholder="e.g. French" className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language Code</label>
                <input required type="text" name="code" placeholder="e.g. fr" className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Number of Levels</label>
                <input required type="number" name="levels" defaultValue={6} className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <button type="submit" className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded text-sm transition-colors mt-2">
                <Plus size={16} /> Add Language
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
