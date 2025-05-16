'use client';

import { Navbar } from '@/components/shared/navbar';
import { ParentAllowance } from '@/components/parent/parent-allowance';
import { useRole } from '@/components/role-provider';
import { Static } from '@/components/Static';

export default function AllowancePage() {
  const { role } = useRole();

  return (
    <main className="min-h-screen">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <div className="container mx-auto px-4 py-8">
        {role === 'parent' ? <ParentAllowance /> : <div />}
      </div>
      <Navbar />
    </main>
  );
}
