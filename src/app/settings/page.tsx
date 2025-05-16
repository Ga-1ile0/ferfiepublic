'use client';

import { Navbar } from '@/components/shared/navbar';
import { ParentSettings } from '@/components/parent/parent-settings';
import { KidSettings } from '@/components/child/kid-settings';
import { useRole } from '@/components/role-provider';
import { Static } from '@/components/Static';

export default function SettingsPage() {
  const { role } = useRole();

  return (
    <main className="min-h-screen ">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <div className="container mx-auto px-4 py-8">
        {role === 'parent' ? <ParentSettings /> : <KidSettings />}
      </div>
      <Navbar />
    </main>
  );
}
