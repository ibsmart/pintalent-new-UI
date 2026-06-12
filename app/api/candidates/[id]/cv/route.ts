import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const candidate = db.prepare('SELECT cv_path, cv_filename FROM candidates WHERE id = ?')
    .get(id) as { cv_path: string; cv_filename: string } | undefined;

  if (!candidate?.cv_path) {
    return NextResponse.json({ error: 'CV introuvable' }, { status: 404 });
  }

  const absPath = path.isAbsolute(candidate.cv_path)
    ? candidate.cv_path
    : path.join(process.cwd(), candidate.cv_path);

  if (!fs.existsSync(absPath)) {
    return NextResponse.json({ error: 'Fichier introuvable sur le serveur' }, { status: 404 });
  }

  const buffer = fs.readFileSync(absPath);
  const ext = path.extname(candidate.cv_path).toLowerCase();
  const mimeType =
    ext === '.pdf'  ? 'application/pdf' :
    ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    ext === '.doc'  ? 'application/msword' :
    'application/octet-stream';

  const filename = candidate.cv_filename || `cv_${id}${ext}`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
