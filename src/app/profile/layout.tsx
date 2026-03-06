import BottomNav from '@/components/BottomNav';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
