import KpiCards from './KpiCards';
import LiveQueue from './LiveQueue';
import EarningsCard from './EarningsCard';
import TasksList from './TasksList';
import Charts7Day from './Charts7Day';

export default function Dashboard() {
  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* 1. Header & KPI Cards */}
      <KpiCards />

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 Cols Wide on LG): Live Queue + 7-Day Performance Charts */}
        <div className="lg:col-span-2 space-y-5">
          <LiveQueue />
          <Charts7Day />
        </div>

        {/* Right Column (1 Col Wide on LG): Shift Earnings + Shift Tasks */}
        <div className="space-y-5">
          <EarningsCard />
          <TasksList />
        </div>
      </div>
    </div>
  );
}
