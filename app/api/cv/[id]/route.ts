import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const candidate = db.prepare('SELECT cv_path, cv_filename FROM candidates WHERE id = ?').get(id) as {
    cv_path: string; cv_filename: string;
  } | undefined;

  if (!candidate?.cv_path) {
    return NextResponse.json({ error: 'CV non trouvé' }, { status: 404 });
  }

  try {
    const buffer = await readFile(candidate.cv_path);
    const ext = path.extname(candidate.cv_filename).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(candidate.cv_filename)}"`,
      }
    });
  } catch {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }
}
