'use client';

import { Navbar } from '@/components/shared/navbar';
import { ParentDashboard } from '@/components/parent/parent-dashboard';
import { KidDashboard } from '@/components/child/kid-dashboard';
import { useRole } from '@/components/role-provider';
import { Static } from '@/components/Static';

export default function Home() {
  return (
    <main className="min-h-screen bg-none pb-20">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <div className="container mx-auto px-4 py-8">
        <Dashboard />
      </div>
      <Navbar />
    </main>
  );
}

function Dashboard() {
  const { role } = useRole();

  return role === 'parent' ? <ParentDashboard /> : <KidDashboard />;
}
