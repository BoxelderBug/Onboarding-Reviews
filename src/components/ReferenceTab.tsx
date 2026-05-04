'use client';

import { BookOpen } from 'lucide-react';

interface Section {
  title: string;
  rows: { token: string; description: string }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Template Variables',
    rows: [
      { token: '[employee]', description: "Employee's full name — Last, First (e.g. Smith, John)" },
      { token: '[employeefirst]', description: "Employee's first name only (e.g. John)" },
    ],
  },
];

const USAGE = [
  {
    where: 'Position → Review Event Templates',
    fields: ['Title', 'Description'],
    example: '30-Day Review: [employee]  →  30-Day Review: Smith, John',
  },
];

export default function ReferenceTab() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reference</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Template variables and shortcuts you can use throughout the app.
        </p>
      </div>

      {/* Variables table */}
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="text-base font-semibold text-gray-900 mb-3">{section.title}</h2>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Token
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Replaced with
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {section.rows.map((row) => (
                  <tr key={row.token} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-sm font-mono bg-gray-100 text-blue-700 px-2 py-0.5 rounded">
                        {row.token}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Where they're used */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Where Variables Work</h2>
        <div className="space-y-3">
          {USAGE.map((u) => (
            <div key={u.where} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-start gap-3">
                <BookOpen className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.where}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Fields: {u.fields.join(', ')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                    {u.example}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Notes</h2>
        <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
          <li>Variables are case-insensitive — <code className="bg-gray-100 px-1 rounded">[Employee]</code> and <code className="bg-gray-100 px-1 rounded">[employee]</code> both work.</li>
          <li>If no custom title is set on a position, the default format is used: <span className="font-mono text-xs bg-gray-100 px-1 rounded">30-Day Review: Last, First</span></li>
          <li>Descriptions support variables too — useful for personalizing agenda text.</li>
        </ul>
      </div>
    </div>
  );
}
