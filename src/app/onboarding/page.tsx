'use client';

import { ParentOnboarding } from '@/components/onboarding/parent-onboarding';
import { Static } from '@/components/Static';

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-none">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <ParentOnboarding />
    </main>
  );
}
