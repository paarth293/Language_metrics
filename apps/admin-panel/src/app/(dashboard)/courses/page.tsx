import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { addCourse, toggleCourseStatus } from "./actions";

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  await requireAdmin();
  
  const courses = await db.course.findMany({
    include: { language: true },
    orderBy: { createdAt: 'desc' }
  });

  const languages = await db.language.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: 'asc' }
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Course Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Courses</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div style={cardStyle} className="rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Course Name</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Language</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Level</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Price (INR)</th>
                    <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <p className="text-[13px] font-medium text-white">{course.name}</p>
                        <p className="text-[11px] text-gray-500">{course.classCount} classes · {course.durationWeeks} weeks</p>
                      </td>
                      <td className="py-3.5 px-5 text-[13px] text-gray-300">{course.language.name}</td>
                      <td className="py-3.5 px-5">
                        <span style={{ background: "var(--lm-surface2)", border: "1px solid var(--lm-border2)", color: "var(--lm-text)" }} className="px-2 py-0.5 rounded text-[11px] font-medium uppercase">
                          {course.level}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[13px] text-white">{(course.price / 100).toFixed(2)}</td>
                      <td className="py-3.5 px-5 text-right">
                        <form action={async () => {
                          "use server";
                          await toggleCourseStatus(course.id, course.published);
                        }}>
                          <button type="submit" className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                            course.published ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'
                          }`}>
                            {course.published ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {course.published ? 'Published' : 'Draft'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {courses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-14 text-center text-gray-500 text-sm">No courses defined yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Create Course</h2>
            <form action={addCourse} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Course Name</label>
                <input required type="text" name="name" placeholder="e.g. Intensive French A1" className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language</label>
                <select required name="languageId" className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500">
                  <option value="">Select a language</option>
                  {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Level</label>
                  <input required type="text" name="level" placeholder="A1" className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price (paise)</label>
                  <input required type="number" name="price" placeholder="150000" className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Duration (wks)</label>
                  <input required type="number" name="durationWeeks" defaultValue={4} className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Classes</label>
                  <input required type="number" name="classCount" defaultValue={8} className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mins/Class</label>
                  <input required type="number" name="classDurationMin" defaultValue={60} className="w-full px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <button type="submit" className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded text-sm transition-colors mt-2">
                <Plus size={16} /> Create Course
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
