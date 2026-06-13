'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/useSettings';
import ClassicTemplate from '@/components/templates/Classic';
import ModernTemplate from '@/components/templates/Modern';
import MinimalTemplate from '@/components/templates/Minimal';

interface Job {
  id: string; title: string; department: string; location: string;
  contract_type: string; description: string; experience: string;
  application_count: number;
}

const DEPARTMENTS = ['Data & BI', 'Digital', 'Innovation', 'Opérations Bancaires', 'Monétique', 'Crédits', 'Risques & Conformité', 'Produits Bancaires', 'Marchés Financiers', 'Finance', 'Commercial', 'Paiements', 'Ressources Humaines', 'IT & Support'];

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filtered, setFiltered] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [contract, setContract] = useState('');

  const { settings, loading: settingsLoading } = useSettings();

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(data => { setJobs(data); setFiltered(data); setJobsLoading(false); });
  }, []);

  useEffect(() => {
    let result = jobs;
    if (search) result = result.filter(j => j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase()) || j.description.toLowerCase().includes(search.toLowerCase()));
    if (dept) result = result.filter(j => j.department === dept);
    if (contract) result = result.filter(j => j.contract_type === contract);
    setFiltered(result);
  }, [search, dept, contract, jobs]);

  if (settingsLoading) return null;

  const props = { jobs, filtered, s: settings, search, setSearch, dept, setDept, contract, setContract, loading: jobsLoading, DEPARTMENTS };

  const template = settings.template || 'classic';
  if (template === 'modern') return <ModernTemplate {...props} />;
  if (template === 'minimal') return <MinimalTemplate {...props} />;
  return <ClassicTemplate {...props} />;
}
