import BottomNav from '@/components/BottomNav';

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
