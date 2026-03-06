import BottomNav from '@/components/BottomNav';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
