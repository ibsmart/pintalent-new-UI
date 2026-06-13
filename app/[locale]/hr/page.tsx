import { redirect } from 'next/navigation';

export default async function HRIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/hr/dashboard`);
}
