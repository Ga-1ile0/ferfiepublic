'use client';

import { Navbar } from '@/components/shared/navbar';
import { ChildrenManagement } from '@/components/parent/children-management';
import { useRole } from '@/components/role-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Static } from '@/components/Static';

export default function ChildrenPage() {
  const { role } = useRole();
  const router = useRouter();

  // Redirect if kid tries to access this page
  useEffect(() => {
    if (role === 'kid') {
      router.push('/');
    }
  }, [role, router]);

  return (
    <main className="min-h-screen bg-none">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <div className="container mx-auto px-4 py-8">
        <ChildrenManagement />
      </div>
      <Navbar />
    </main>
  );
}
