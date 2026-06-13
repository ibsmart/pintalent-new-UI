'use client';

import { use } from 'react';
import TemplateFormPage from '../../_form';

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TemplateFormPage editingId={id} />;
}
