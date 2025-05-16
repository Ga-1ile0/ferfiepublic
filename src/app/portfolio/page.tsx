'use client';
import { Navbar } from '@/components/shared/navbar';
import { Static } from '@/components/Static';
import { KidPortfolio } from '@/components/child/kid-portfolio';

export default function PortfolioPage() {
  return (
    <main className="min-h-screen">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <div className="container mx-auto px-4 py-8">
        <KidPortfolio />
      </div>
      <Navbar />
    </main>
  );
}
