import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckSquare, Square, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { DAILY_TASKS, LEADS } from '../../data/mockData';
import type { DailyTask } from '../../types';

export default function TasksList() {
  const {
    setLeadsModalOpen,
    setLeadsModalPage,
    setActiveView,
    setPulseView,
    setActiveChannelId,
    setPlanTab,
    showToast,
  } = useApp();

  const [tasks, setTasks] = useState<DailyTask[]>(DAILY_TASKS);

  const toggleTask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const task = tasks.find((t) => t.id === id);
    if (task) {
      showToast(task.done ? `Marked "${task.label}" as pending` : `Completed: "${task.label}"`);
    }
  };

  const handleTaskClick = (task: DailyTask) => {
    if (task.leadId) {
      // Find lead index in LEADS
      const index = LEADS.findIndex((l) => l.id === task.leadId);
      setLeadsModalPage(index !== -1 ? index : 0);
      setLeadsModalOpen(true);
    } else if (task.id === 't4') {
      // Review SOP
      setActiveView('plan');
      setPlanTab('recent');
    } else if (task.id === 't5') {
      // Confirm Friday coaching
      setActiveView('pulse');
      setPulseView('channel');
      setActiveChannelId('callcentre-team');
    }
  };

  const completedCount = tasks.filter((t) => t.done).length;

  return (
    <div className="bg-white rounded-card border border-og-gray-border p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-og-gray-border mb-3.5">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-purple-50 text-og-purple-light">
            <CheckSquare size={16} />
          </span>
          <h3 className="text-sm font-bold text-[#1c1c1e]">My Shift Tasks</h3>
        </div>
        <span className="text-xs bg-purple-50 text-og-purple-mid font-bold px-2 py-0.5 rounded-full">
          {completedCount}/{tasks.length} Done
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              task.done
                ? 'bg-og-gray/30 border-og-gray-border opacity-70'
                : 'bg-white border-og-gray-border hover:border-og-green/40 hover:shadow-xs'
            }`}
          >
            {/* 1. Independent Checkbox Button */}
            <button
              type="button"
              onClick={() => toggleTask(task.id)}
              className="text-og-green hover:text-og-forest transition-colors p-1 mr-2.5 flex-shrink-0 rounded-md focus:outline-hidden focus:ring-2 focus:ring-og-green"
              aria-label={`Mark task "${task.label}" as ${task.done ? 'pending' : 'completed'}`}
            >
              {task.done ? (
                <CheckCircle2 size={19} className="text-og-green fill-og-green-bg" />
              ) : (
                <Square size={19} className="text-gray-300 hover:text-og-green" />
              )}
            </button>

            {/* 2. Independent Task Action Button */}
            <button
              type="button"
              onClick={() => handleTaskClick(task)}
              className="flex-1 flex items-center justify-between text-left min-w-0 group focus:outline-hidden focus:ring-2 focus:ring-og-green rounded-md py-0.5 px-1 -ml-1"
              aria-label={`Open task details: ${task.label}`}
            >
              <div className="min-w-0 flex-1">
                <span
                  className={`text-xs font-semibold block truncate ${
                    task.done ? 'line-through text-og-gray-text' : 'text-[#1c1c1e] group-hover:text-og-forest'
                  }`}
                >
                  {task.label}
                </span>
                {task.leadId && (
                  <span className="text-[10px] text-og-green font-bold flex items-center gap-1 mt-0.5">
                    <Sparkles size={11} />
                    Click to open lead dossier
                  </span>
                )}
              </div>

              <ChevronRight
                size={15}
                className="text-gray-300 group-hover:text-og-forest transition-colors flex-shrink-0 ml-2"
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
