import { SchedulingNav } from "./scheduling-nav";

// Auth and the outer app shell are already handled by (app)/layout.tsx —
// this just puts the Scheduling product's own nav above every page under
// /schedule, since the Admin top bar deliberately goes empty here.
export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SchedulingNav />
      {children}
    </div>
  );
}
