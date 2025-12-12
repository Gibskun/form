import React from 'react';
import { useRouter } from 'next/router';
import AdminLogin from '@/components/AdminLogin';

export default function Home() {
  const router = useRouter();

  React.useEffect(() => {
    // Redirect to admin login page
    router.replace('/admin');
  }, [router]);

  return <AdminLogin />;
}
