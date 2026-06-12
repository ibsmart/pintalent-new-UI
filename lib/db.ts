import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const ALL_PERMISSIONS = [
  'candidates.view', 'candidates.create', 'candidates.delete',
  'jobs.view', 'jobs.create', 'jobs.delete',
  'pipeline.view', 'pipeline.edit',
  'matching.run', 'notes.add', 'email.manage',
  'team.manage', 'data.delete',
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin:   ALL_PERMISSIONS,
  rh:      ['candidates.view','candidates.create','candidates.delete','jobs.view','jobs.create','jobs.delete','pipeline.view','pipeline.edit','matching.run','notes.add','email.manage'],
  manager: ['candidates.view','jobs.view','pipeline.view','pipeline.edit','notes.add'],
  viewer:  ['candidates.view','jobs.view','pipeline.view'],
};

const DB_PATH = path.join(process.cwd(), 'data', 'recruitment.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'IT',
      location TEXT NOT NULL DEFAULT 'Casablanca',
      contract_type TEXT NOT NULL DEFAULT 'CDI',
      description TEXT NOT NULL,
      missions TEXT,
      profile TEXT,
      keywords TEXT,
      experience TEXT,
      education TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      linkedin TEXT,
      cv_filename TEXT,
      cv_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      job_id TEXT NOT NULL REFERENCES jobs(id),
      cover_letter TEXT,
      score INTEGER DEFAULT 0,
      score_summary TEXT,
      strengths TEXT,
      gaps TEXT,
      recommendation TEXT DEFAULT 'À évaluer',
      pipeline_stage TEXT NOT NULL DEFAULT 'Nouveau',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      content TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'RH',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'hr',
      active INTEGER NOT NULL DEFAULT 1,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const jobCount = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
  if (jobCount === 0) {
    seedJobs(db);
  }

  // ── Migrations (always run first, before any seeds that use new columns) ──
  try { db.exec("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#6366f1'"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'))"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN last_login TEXT"); } catch { /* exists */ }
  // Add cv_text column to candidates if not exists (migration for existing DBs)
  try { db.exec('ALTER TABLE candidates ADD COLUMN cv_text TEXT DEFAULT ""'); } catch { /* already exists */ }
  // Unique index on email to prevent duplicate candidates
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email)'); } catch { /* already exists */ }
  // Salary / contract fields
  try { db.exec("ALTER TABLE candidates ADD COLUMN contract_preference TEXT DEFAULT 'CDI'"); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE candidates ADD COLUMN current_salary TEXT DEFAULT ""'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE candidates ADD COLUMN desired_salary TEXT DEFAULT ""'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE candidates ADD COLUMN tjm TEXT DEFAULT ""'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE candidates ADD COLUMN notice_period TEXT DEFAULT ""'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE candidates ADD COLUMN current_title TEXT DEFAULT ""'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE candidates ADD COLUMN years_experience TEXT DEFAULT ""'); } catch { /* already exists */ }
  // Add campaign_id to jobs if not exists
  try { db.exec('ALTER TABLE jobs ADD COLUMN campaign_id TEXT REFERENCES projects(id) ON DELETE SET NULL'); } catch { /* already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      nb_positions INTEGER NOT NULL DEFAULT 1,
      deadline TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  try { db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `); } catch { /* already exists */ }

  try { db.exec(`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `); } catch { /* already exists */ }

  try { db.exec(`
    CREATE TABLE IF NOT EXISTS automation_logs (
      id TEXT PRIMARY KEY,
      automation_id TEXT REFERENCES automations(id) ON DELETE SET NULL,
      automation_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      recipient TEXT,
      subject TEXT,
      candidate_name TEXT,
      job_title TEXT,
      pipeline_stage TEXT,
      error TEXT,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `); } catch { /* already exists */ }

  // Job boards
  try { db.exec(`
    CREATE TABLE IF NOT EXISTS job_board_integrations (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `); } catch { /* already exists */ }

  try { db.exec(`
    CREATE TABLE IF NOT EXISTS job_postings (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      external_id TEXT,
      external_url TEXT,
      error TEXT,
      posted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `); } catch { /* already exists */ }

  // Role permissions table
  try { db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (role, permission)
    )
  `); } catch { /* already exists */ }

  // CV Templates
  try { db.exec(`
    CREATE TABLE IF NOT EXISTS cv_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primary_color TEXT NOT NULL DEFAULT '#1e40af',
      secondary_color TEXT NOT NULL DEFAULT '#f1f5f9',
      accent_color TEXT NOT NULL DEFAULT '#3b82f6',
      font_style TEXT NOT NULL DEFAULT 'modern',
      logo_base64 TEXT DEFAULT '',
      company_name TEXT DEFAULT '',
      show_photo INTEGER NOT NULL DEFAULT 0,
      anonymize_name INTEGER NOT NULL DEFAULT 0,
      anonymize_contact INTEGER NOT NULL DEFAULT 0,
      sections TEXT NOT NULL DEFAULT '["summary","experience","skills","education","languages"]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `); } catch { /* already exists */ }

  seedPermissions(db);

  seedSettings(db);
  seedTemplates(db);
  seedAdminUser(db);
}

function seedPermissions(db: Database.Database) {
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const perm of ALL_PERMISSIONS) {
      const exists = db.prepare('SELECT 1 FROM role_permissions WHERE role=? AND permission=?').get(role, perm);
      if (!exists) {
        db.prepare('INSERT INTO role_permissions (role, permission, enabled) VALUES (?,?,?)')
          .run(role, perm, perms.includes(perm) ? 1 : 0);
      }
    }
  }
}

function seedAdminUser(db: Database.Database) {
  // Always runs AFTER all migrations so active/avatar_color columns exist
  let hash = '$2b$10$placeholder_hashed';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs');
    hash = bcrypt.hashSync('Admin2024!', 10);
  } catch { /* bcryptjs not available */ }

  const existingAdmin = db.prepare("SELECT id, password_hash FROM users WHERE id = 'user-1'").get() as { id: string; password_hash: string } | undefined;
  if (!existingAdmin) {
    db.prepare(`INSERT INTO users (id, email, password_hash, name, role, active, avatar_color) VALUES (?, ?, ?, ?, ?, 1, ?)`)
      .run('user-1', 'admin@geekfact.com', hash, 'Administrateur', 'admin', '#b91c1c');
  } else if (existingAdmin.password_hash.includes('placeholder')) {
    // Fix the fake hash and update email/name
    db.prepare("UPDATE users SET password_hash = ?, email = ?, name = ?, avatar_color = ? WHERE id = 'user-1'")
      .run(hash, 'admin@geekfact.com', 'Administrateur', '#b91c1c');
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  // Identité
  company_name: 'GEEKFACT',
  logo_initials: 'GF',
  logo_url: '',
  primary_color: '#b91c1c',
  // Hero
  hero_title: "Façonnez l'avenir bancaire africain",
  hero_subtitle: "Rejoignez GEEKFACT, groupe bancaire panafricain de référence présent dans 20+ pays. Contribuez à la transformation digitale d'un secteur en pleine mutation.",
  hero_badge: 'postes ouverts au recrutement',
  cta_primary: 'Voir les offres →',
  cta_secondary: 'Découvrir GF',
  // Stats hero
  stat1_value: '20+',  stat1_label: 'Pays de présence',
  stat2_value: '6 000+', stat2_label: 'Collaborateurs',
  stat3_value: '4M+',  stat3_label: 'Clients',
  stat4_value: '60+',  stat4_label: "Années d'expérience",
  // Section offres
  jobs_section_title: "Nos offres d'emploi",
  jobs_section_subtitle: 'Trouvez le poste qui correspond à votre profil et vos ambitions',
  // Section À propos
  about_title: 'Pourquoi nous rejoindre ?',
  value1_icon: '🌍', value1_title: 'Impact panafricain',       value1_desc: "Participez au développement économique du continent africain à travers des projets à grande échelle.",
  value2_icon: '🚀', value2_title: 'Transformation digitale',  value2_desc: "Soyez acteur de la révolution numérique du secteur bancaire avec des technologies de pointe.",
  value3_icon: '📈', value3_title: 'Évolution de carrière',    value3_desc: "Bénéficiez d'opportunités de mobilité interne dans 20+ pays et d'un plan de développement personnalisé.",
  value4_icon: '🤝', value4_title: 'Culture inclusive',        value4_desc: "Intégrez une équipe diverse et multiculturelle où l'excellence et l'innovation sont valorisées.",
  // Contact & Footer
  contact_email: 'recrutement@geekfact.com',
  contact_phone: '',
  linkedin_url: '',
  website_url: '',
  footer_copyright: '© 2024 GEEKFACT Group. Tous droits réservés.',
  // SEO
  meta_title: 'Carrières - GEEKFACT',
  meta_description: "Rejoignez GEEKFACT et contribuez à la transformation digitale du secteur bancaire africain.",
};

export function getSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function seedSettings(db: Database.Database) {
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    stmt.run(key, value);
  }
}

function seedTemplates(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM email_templates').get() as { c: number }).c;
  if (count > 0) return;

  const stmt = db.prepare(`INSERT INTO email_templates (id, name, subject, body, variables) VALUES (?, ?, ?, ?, ?)`);

  stmt.run(
    'tpl-convocation',
    'Convocation entretien',
    'Convocation à un entretien - {{offre.titre}}',
    `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #b91c1c; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Convocation à un entretien</h1>
  </div>
  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
    <p>Madame, Monsieur <strong>{{candidat.nom}}</strong>,</p>
    <p>Nous avons bien étudié votre candidature pour le poste de <strong>{{offre.titre}}</strong> et nous avons le plaisir de vous convoquer à un entretien.</p>
    <div style="background: #f9fafb; border-left: 4px solid #b91c1c; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0;"><strong>Poste :</strong> {{offre.titre}}</p>
      <p style="margin: 8px 0 0;"><strong>Étape :</strong> {{pipeline.etape}}</p>
    </div>
    <p>Notre équipe de recrutement prendra contact avec vous prochainement pour confirmer les modalités.</p>
    <p>Cordialement,</p>
    <p><strong>{{recruteur.nom}}</strong><br>{{entreprise.nom}}</p>
  </div>
</body>
</html>`,
    JSON.stringify(['candidat.nom', 'offre.titre', 'pipeline.etape', 'recruteur.nom', 'entreprise.nom'])
  );

  stmt.run(
    'tpl-recue',
    'Candidature reçue',
    'Nous avons bien reçu votre candidature - {{offre.titre}}',
    `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #b91c1c; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Candidature bien reçue</h1>
  </div>
  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
    <p>Madame, Monsieur <strong>{{candidat.nom}}</strong>,</p>
    <p>Nous accusons réception de votre candidature pour le poste de <strong>{{offre.titre}}</strong> au sein de <strong>{{entreprise.nom}}</strong>.</p>
    <p>Votre dossier sera étudié avec attention par notre équipe de recrutement. Nous reviendrons vers vous dans les meilleurs délais.</p>
    <p>Nous vous remercions de l'intérêt que vous portez à notre groupe.</p>
    <p>Cordialement,</p>
    <p><strong>{{recruteur.nom}}</strong><br>{{entreprise.nom}}</p>
  </div>
</body>
</html>`,
    JSON.stringify(['candidat.nom', 'offre.titre', 'recruteur.nom', 'entreprise.nom'])
  );

  stmt.run(
    'tpl-retenue',
    'Candidature retenue',
    'Bonne nouvelle ! Votre candidature pour {{offre.titre}} est retenue',
    `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #b91c1c; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Bonne nouvelle !</h1>
  </div>
  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
    <p>Madame, Monsieur <strong>{{candidat.nom}}</strong>,</p>
    <p>Nous avons le plaisir de vous informer que votre candidature pour le poste de <strong>{{offre.titre}}</strong> a été retenue.</p>
    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 16px; margin: 24px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #16a34a; font-weight: bold; font-size: 16px;">Félicitations !</p>
      <p style="margin: 8px 0 0; color: #166534;">Votre profil a été sélectionné pour l'étape : {{pipeline.etape}}</p>
    </div>
    <p>Notre équipe de recrutement vous contactera prochainement pour la suite du processus.</p>
    <p>Cordialement,</p>
    <p><strong>{{recruteur.nom}}</strong><br>{{entreprise.nom}}</p>
  </div>
</body>
</html>`,
    JSON.stringify(['candidat.nom', 'offre.titre', 'pipeline.etape', 'recruteur.nom', 'entreprise.nom'])
  );

  stmt.run(
    'tpl-non-retenue',
    'Candidature non retenue',
    'Suite à votre candidature pour {{offre.titre}}',
    `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #6b7280; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Suite à votre candidature</h1>
  </div>
  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">
    <p>Madame, Monsieur <strong>{{candidat.nom}}</strong>,</p>
    <p>Nous vous remercions de l'intérêt que vous avez manifesté pour le poste de <strong>{{offre.titre}}</strong> au sein de <strong>{{entreprise.nom}}</strong> et du temps que vous nous avez consacré.</p>
    <p>Après examen attentif de votre candidature, nous avons le regret de vous informer qu'elle n'a pas été retenue pour ce poste. En effet, d'autres profils correspondaient davantage aux critères requis pour ce recrutement.</p>
    <p>Nous conservons néanmoins votre dossier et n'hésiterons pas à vous recontacter si une opportunité correspondant à votre profil se présente.</p>
    <p>Nous vous souhaitons plein succès dans vos recherches.</p>
    <p>Cordialement,</p>
    <p><strong>{{recruteur.nom}}</strong><br>{{entreprise.nom}}</p>
  </div>
</body>
</html>`,
    JSON.stringify(['candidat.nom', 'offre.titre', 'recruteur.nom', 'entreprise.nom'])
  );
}

function seedJobs(db: Database.Database) {
  const jobs = getGeekfactJobs();
  const stmt = db.prepare(`
    INSERT INTO jobs (id, title, department, location, contract_type, description, missions, profile, keywords, experience, education, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  for (const job of jobs) {
    stmt.run(job.id, job.title, job.department, job.location, job.contract_type,
      job.description, job.missions, job.profile, job.keywords, job.experience, job.education);
  }
}

function getGeekfactJobs() {
  return [
    {
      id: 'job-001', title: 'Data Analyst', department: 'Data & BI', location: 'Casablanca', contract_type: 'CDI',
      experience: '3-5 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Python, SQL, Power BI, Tableau, Business Intelligence, Reporting, ETL, Data Warehouse',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 3 à 5 ans en analyse de données, business intelligence ou reporting, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Collecter, nettoyer et analyser des données issues de sources multiples (systèmes bancaires, CRM, ERP)\n• Concevoir et maintenir des tableaux de bord et rapports BI (Power BI, Tableau, QlikSense)\n• Identifier les tendances et KPIs métiers pour guider la prise de décision\n• Collaborer avec les équipes métiers (Commercial, Risque, Finance) pour comprendre leurs besoins analytiques\n• Rédiger les spécifications fonctionnelles des besoins en reporting\n• Garantir la qualité et la cohérence des données publiées`,
      description: `Rejoignez GEEKFACT en tant que Data Analyst et participez à la transformation data d\'un groupe bancaire panafricain de référence. Au sein de la Direction Data & BI, vous jouerez un rôle clé dans la valorisation des données pour piloter la performance du Groupe.\n\nVous serez un acteur central de la modernisation de notre écosystème analytique, en accompagnant les équipes métiers dans leur transition vers une culture data-driven.`
    },
    {
      id: 'job-002', title: 'Chef de Projet Technico-Fonctionnel Data', department: 'Data & BI', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-10 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Gestion de projet, Data, Business Intelligence, Transformation digitale, SQL, Agile, Scrum',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 10 ans en gestion de projets data, business intelligence ou transformation digitale, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets data de bout en bout (cadrage, spécifications, développement, déploiement)\n• Assurer l\'interface entre les équipes métiers et les équipes techniques\n• Rédiger les expressions de besoins et cahiers des charges fonctionnels\n• Planifier et suivre les livrables, budgets et délais\n• Animer les comités de pilotage et de suivi projet\n• Accompagner le changement et former les utilisateurs`,
      description: `En tant que Chef de Projet Technico-Fonctionnel Data chez GEEKFACT, vous piloterez des projets stratégiques de transformation data au sein d\'un groupe bancaire de premier plan. Vous êtes le chef d\'orchestre entre les ambitions métiers et la réalité technique, garantissant la livraison de solutions data à forte valeur ajoutée.`
    },
    {
      id: 'job-003', title: 'Data Architect', department: 'Data & BI', location: 'Casablanca', contract_type: 'CDI',
      experience: '8-12 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Architecture data, Big Data, Hadoop, Spark, Data Lake, Data Warehouse, SQL, NoSQL, Cloud',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 8 à 12 ans dans la conception d\'architectures data, de plateformes décisionnelles ou de solutions Big Data, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Concevoir et faire évoluer l\'architecture data du Groupe (Data Lake, Data Warehouse, Data Mesh)\n• Définir les standards, normes et patterns d\'ingénierie des données\n• Superviser les développements techniques des équipes Data Engineering\n• Évaluer et sélectionner les technologies et outils data\n• Assurer la performance, la disponibilité et la sécurité des plateformes data\n• Participer aux comités d\'architecture et contribuer à la roadmap technique`,
      description: `GEEKFACT recherche un Data Architect expérimenté pour concevoir et piloter l\'évolution de son architecture data groupe. Vous définirez les fondations techniques qui permettront au Groupe d\'exploiter pleinement la valeur de ses données à l\'échelle panafricaine.`
    },
    {
      id: 'job-004', title: 'Data Governance Manager', department: 'Data & BI', location: 'Casablanca', contract_type: 'CDI',
      experience: '8-12 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Data Governance, Qualité des données, RGPD, Conformité, Data Catalog, Master Data Management, MDM',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 8 à 12 ans en gouvernance des données, qualité des données ou conformité réglementaire, dont une expérience significative dans le secteur bancaire ou financier.',
      missions: `• Définir et mettre en œuvre la politique de gouvernance des données du Groupe\n• Créer et animer la communauté des Data Stewards\n• Mettre en place le Data Catalog et les référentiels de données\n• Garantir la conformité des traitements de données (RGPD, réglementations locales)\n• Piloter les initiatives de qualité des données et KPIs associés\n• Sensibiliser et former l\'organisation à la culture data`,
      description: `Rejoignez GEEKFACT pour bâtir et déployer un programme de Data Governance à l\'échelle d\'un groupe bancaire panafricain. En tant que Data Governance Manager, vous serez le garant de la qualité, de la sécurité et de la conformité des données du Groupe, avec un impact direct sur la prise de décision stratégique.`
    },
    {
      id: 'job-005', title: 'Data Scientist', department: 'Data & BI', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-10 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Python, Machine Learning, Deep Learning, Scikit-learn, TensorFlow, MLflow, Statistiques, NLP',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 10 ans en data science, modélisation statistique et machine learning, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Développer des modèles prédictifs et prescriptifs (scoring crédit, détection fraude, segmentation client)\n• Conduire les phases d\'exploration, feature engineering et validation des modèles\n• Mettre en production les modèles ML en collaboration avec les équipes MLOps\n• Interpréter et communiquer les résultats aux parties prenantes métiers\n• Réaliser une veille technologique sur les avancées en IA et ML\n• Participer à des projets transversaux d\'innovation data`,
      description: `GEEKFACT offre à ses Data Scientists un terrain d\'expérimentation unique : des données bancaires riches et diversifiées à l\'échelle du continent africain. Vous développerez des modèles à fort impact business, de la détection de fraude à l\'optimisation de l\'expérience client.`
    },
    {
      id: 'job-006', title: 'Chef de Projet AMOA Digital Retail', department: 'Digital', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-8 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'AMOA, Digital, Retail Banking, Parcours client, Mobile Banking, UX, Agile, Scrum',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 8 ans en AMOA, gestion de projets digitaux ou transformation des parcours clients, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Piloter les projets de digitalisation des parcours clients retail (ouverture de compte, crédits, épargne)\n• Recueillir et formaliser les besoins fonctionnels des métiers retail\n• Rédiger les user stories et cahiers des charges fonctionnels\n• Coordonner les équipes techniques, UX et métiers\n• Assurer la recette fonctionnelle et le suivi des déploiements\n• Contribuer à la roadmap digitale retail du Groupe`,
      description: `Rejoignez la Direction Digitale de GEEKFACT et participez à la révolution de l\'expérience bancaire retail. En tant que Chef de Projet AMOA Digital Retail, vous piloterez la conception et le déploiement de services bancaires digitaux innovants pour des millions de clients particuliers.`
    },
    {
      id: 'job-007', title: 'Chef de Projet AMOA Digital Corporate', department: 'Digital', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-8 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'AMOA, Digital, Corporate Banking, Trésorerie, Trade Finance, Cash Management, Portail entreprise',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 8 ans en AMOA, gestion de projets digitaux corporate ou transformation des services aux entreprises, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Piloter les projets de digitalisation des services bancaires destinés aux entreprises\n• Coordonner la mise en place de portails corporate (cash management, trade finance)\n• Recueillir et analyser les besoins des équipes corporate et des grandes entreprises clientes\n• Rédiger les spécifications fonctionnelles détaillées\n• Suivre les développements et assurer les recettes fonctionnelles\n• Gérer les relations avec les partenaires et éditeurs de solutions`,
      description: `GEEKFACT recherche un Chef de Projet AMOA Digital Corporate pour piloter la transformation numérique de ses services aux entreprises. Vous aurez l\'opportunité de concevoir des solutions digitales innovantes qui simplifieront les opérations bancaires des grandes entreprises et PME africaines.`
    },
    {
      id: 'job-008', title: 'Chef de Projet AMOA Digital Paiement', department: 'Digital', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-8 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'AMOA, Paiement, Monétique, Mobile Money, Wallet, SWIFT, SEPA, API Payment',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 8 ans en AMOA paiements, monétique ou systèmes de paiement digitaux, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Piloter les projets d\'évolution des systèmes de paiement digitaux (mobile money, wallets, transferts)\n• Analyser et formaliser les besoins en matière de paiements instantanés et cross-border\n• Coordonner les intégrations avec les réseaux de paiement (SWIFT, cartes, interopérabilité)\n• Assurer la conformité réglementaire des solutions de paiement\n• Contribuer à l\'innovation payment (open banking, APIs, FinTech)\n• Suivre les indicateurs de performance des plateformes de paiement`,
      description: `Participez à l\'avenir des paiements africains chez GEEKFACT. En tant que Chef de Projet AMOA Digital Paiement, vous serez au cœur de l\'innovation dans les systèmes de paiement, pilotant des projets qui impactent directement des millions de transactions quotidiennes à travers l\'Afrique.`
    },
    {
      id: 'job-009', title: 'Chef de Projet Innovation', department: 'Innovation', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-8 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Innovation, POC, Fintech, Design Thinking, Agile, Blockchain, IA, Open Innovation',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 8 ans en innovation, transformation digitale, conduite de POC ou développement de nouveaux services, idéalement acquise dans le secteur bancaire, financier ou au sein d\'un cabinet de conseil.',
      missions: `• Identifier et évaluer les tendances technologiques et les opportunités d\'innovation bancaire\n• Conduire des POC et expérimentations sur des technologies émergentes (Blockchain, IA, IoT)\n• Collaborer avec l\'écosystème FinTech et les partenaires technologiques\n• Animer les ateliers Design Thinking et co-création avec les équipes métiers\n• Piloter le portefeuille de projets innovation et leur passage à l\'échelle\n• Contribuer à la culture innovation du Groupe`,
      description: `GEEKFACT cherche un Chef de Projet Innovation passionné par les technologies de rupture et leur application au secteur bancaire africain. Vous serez l\'explorateur de nouveaux horizons technologiques, transformant les idées innovantes en services bancaires concrets et différenciants.`
    },
    {
      id: 'job-010', title: 'Chef de Projet Intelligence Artificielle', department: 'Innovation', location: 'Casablanca', contract_type: 'CDI',
      experience: '5-10 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Intelligence Artificielle, Machine Learning, LLM, NLP, Computer Vision, MLOps, Python',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 5 à 10 ans en intelligence artificielle, data analytics, machine learning ou pilotage de projets technologiques innovants, idéalement acquise dans le secteur bancaire, financier ou au sein d\'un cabinet de conseil.',
      missions: `• Piloter les projets d\'IA et de Machine Learning stratégiques du Groupe\n• Définir la roadmap IA et identifier les cas d\'usage à fort impact\n• Coordonner les équipes Data Science, IT et métiers sur les projets IA\n• Assurer la mise en production et le suivi des modèles IA\n• Gérer les risques liés à l\'IA (biais, explicabilité, conformité)\n• Développer les partenariats avec les acteurs de l\'IA (startups, universités)`,
      description: `Rejoignez GEEKFACT pour diriger la stratégie d\'Intelligence Artificielle d\'un groupe bancaire panafricain en pleine transformation. En tant que Chef de Projet IA, vous piloterez des projets qui redéfiniront l\'expérience bancaire grâce à l\'IA : chatbots intelligents, scoring automatisé, détection de fraude avancée.`
    },
    {
      id: 'job-011', title: 'Chef de Projet AMOA Senior – Opérations Agence, Change & Flux', department: 'Opérations Bancaires', location: 'Casablanca', contract_type: 'CDI',
      experience: '8-10 ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Core Banking, CBS, Opérations agence, Change, Flux, SWIFT, Transformation SI, T24',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience de 8 à 10 ans en gestion de projets bancaires, idéalement acquise dans des projets de transformation SI, de mise en place ou d\'évolution de Core Banking System (CBS), des opérations agences, du change ou des flux.',
      missions: `• Piloter les projets d\'évolution du Core Banking System sur les modules opérations agence, change et flux\n• Coordonner les migrations et déploiements SI dans le réseau agences\n• Rédiger les expressions de besoins et spécifications fonctionnelles détaillées\n• Assurer la conduite du changement et la formation des utilisateurs\n• Superviser les recettes fonctionnelles et accompagner les démarrages\n• Gérer les relations avec les éditeurs et intégrateurs de CBS`,
      description: `GEEKFACT recrute un Chef de Projet AMOA Senior expérimenté dans les opérations bancaires pour piloter les évolutions critiques de son système d\'information bancaire. Vous interviendrez sur des projets structurants liés aux opérations agence, au change et aux flux interbancaires, avec un impact sur l\'ensemble du réseau.`
    },
    {
      id: 'job-012', title: 'Chef de Projet AMOA Monétique', department: 'Monétique', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Monétique, TPE, GAB, Carte bancaire, VISA, Mastercard, Autorisation, Compensation',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en gestion de projets monétiques ou systèmes de paiement, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets monétiques (émission/acquisition cartes, GAB, TPE, 3DS)\n• Gérer les certifications et homologations avec VISA, Mastercard et CMI\n• Coordonner les évolutions des systèmes d\'autorisation et de compensation\n• Assurer la conformité PCI-DSS des systèmes monétiques\n• Analyser les incidents et fraudes monétiques, mettre en place des actions correctives\n• Contribuer aux projets de digitalisation des paiements par carte`,
      description: `Rejoignez le département Monétique de GEEKFACT pour piloter les projets d\'évolution d\'un parc monétique de grande envergure. Expert des systèmes de paiement par carte, vous jouerez un rôle clé dans la sécurisation et la modernisation de l\'infrastructure monétique du Groupe.`
    },
    {
      id: 'job-013', title: 'Chef de Projet Crédits & Engagements', department: 'Crédits', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Crédit immobilier, Crédit consommation, Scoring crédit, LCO, Engagements, Recouvrement',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en gestion de projets crédits, engagements ou recouvrement, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets d\'évolution des systèmes de gestion des crédits et engagements\n• Coordonner les projets de digitalisation du parcours crédit (demande, instruction, déblocage)\n• Rédiger les spécifications fonctionnelles pour les modules crédit du CBS\n• Assurer la conformité réglementaire des processus crédit (BAM, Bâle III)\n• Collaborer avec les équipes risque, conformité et opérations\n• Suivre les indicateurs qualité des processus crédit`,
      description: `GEEKFACT recherche un Chef de Projet spécialisé en Crédits & Engagements pour moderniser et digitaliser ses processus de gestion du crédit. Vous piloterez des projets stratégiques qui amélioreront l\'expérience des clients emprunteurs tout en optimisant les processus internes.`
    },
    {
      id: 'job-014', title: 'Chef de Projet Risque GRC', department: 'Risques & Conformité', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École ou Commerce',
      keywords: 'GRC, Risques opérationnels, Contrôle permanent, Conformité, Bâle III, ICAAP, Cartographie des risques',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs ou de commerce, avec une expérience d\'au moins 5 ans en gestion de projets risques opérationnels, contrôle permanent ou conformité, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets de mise en place et d\'évolution de la plateforme GRC\n• Coordonner le déploiement des outils de cartographie des risques et de contrôle permanent\n• Assurer la conformité aux réglementations locales et internationales (Bâle, BAM, BCEAO)\n• Collaborer avec les équipes Audit, Conformité et Contrôle de Gestion\n• Produire le reporting risques pour les instances de gouvernance\n• Former et accompagner les équipes métiers sur les processus GRC`,
      description: `GEEKFACT recherche un Chef de Projet GRC pour piloter le déploiement et l\'évolution de son dispositif de gestion des risques et de la conformité. Vous interviendrez dans un contexte réglementaire exigeant, avec un fort impact sur la solidité et la réputation du Groupe.`
    },
    {
      id: 'job-015', title: 'Chef de Projet AMOA Senior – Produits & Services', department: 'Produits Bancaires', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Produits bancaires, CBS, Tarification, Outils de vente, CRM commercial, Core Banking',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en gestion de projets produits bancaires, outils de vente, tarification ou Core Banking System (CBS), idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets d\'évolution des produits et services bancaires dans le CBS\n• Coordonner les projets de mise à jour des outils de tarification et de paramétrage\n• Recueillir et formaliser les besoins des équipes commerciales et marketing\n• Assurer la cohérence entre les offres produits et leur paramétrage SI\n• Gérer les recettes fonctionnelles des nouvelles fonctionnalités produits\n• Contribuer au catalogue produits et à la stratégie de go-to-market`,
      description: `Rejoignez la Direction Produits de GEEKFACT pour piloter l\'évolution du catalogue de produits et services bancaires. Vous travaillerez à l\'interface entre les équipes marketing, commerciales et IT pour garantir que les innovations produits se concrétisent rapidement et efficacement.`
    },
    {
      id: 'job-016', title: 'Chef de Projet AMOA Titres', department: 'Marchés Financiers', location: 'Casablanca', contract_type: 'CDI',
      experience: '4+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Titres, Marchés financiers, Back-office titres, Custody, SWIFT, Post-marché, Bourse',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience minimale de 4 ans en gestion de projets titres, marchés financiers ou transformation des systèmes d\'information, acquise au sein d\'un cabinet de conseil, d\'une banque ou d\'une compagnie d\'assurance.',
      missions: `• Piloter les projets d\'évolution des systèmes de gestion des titres et des marchés\n• Coordonner les projets de post-marché et de custody\n• Rédiger les spécifications fonctionnelles pour les modules titres du SI\n• Assurer la conformité réglementaire des opérations sur titres\n• Collaborer avec les dépositaires centraux et les contreparties\n• Suivre les évolutions réglementaires sur les marchés financiers africains`,
      description: `GEEKFACT recherche un Chef de Projet AMOA Titres pour piloter la modernisation de ses systèmes de gestion des titres et marchés financiers. Vous interviendrez sur des projets à fort enjeu réglementaire et technique, avec une visibilité sur les marchés financiers africains.`
    },
    {
      id: 'job-017', title: 'Chef de Projet AMOA Finances', department: 'Finance', location: 'Casablanca', contract_type: 'CDI',
      experience: '4+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Finance, Comptabilité, IFRS, Pilotage financier, Consolidation, Reporting financier, SAP',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience minimale de 4 ans en gestion de projets finance, comptabilité ou pilotage financier, acquise au sein d\'un cabinet de conseil, d\'une banque ou d\'une compagnie d\'assurance.',
      missions: `• Piloter les projets d\'évolution des systèmes financiers et comptables\n• Coordonner les projets IFRS, consolidation et clôtures comptables\n• Rédiger les spécifications fonctionnelles pour les modules finance du SI\n• Assurer la conformité réglementaire des traitements comptables et financiers\n• Collaborer avec les équipes Finance, Consolidation et Contrôle de Gestion\n• Suivre les évolutions des normes comptables internationales`,
      description: `Rejoignez la Direction Financière de GEEKFACT pour piloter les projets de transformation des systèmes d\'information financiers. Vous aurez un rôle clé dans la modernisation des outils de pilotage financier d\'un groupe bancaire panafricain coté.`
    },
    {
      id: 'job-018', title: 'Chef de Projet AMOA Conformité', department: 'Risques & Conformité', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Conformité, KYC, LCB-FT, RGPD, BAM, Réglementation bancaire, Veille réglementaire',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en AMOA conformité, gestion de projets réglementaires ou transformation des dispositifs de conformité, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets de mise en conformité réglementaire (KYC, LCB-FT, RGPD)\n• Coordonner le déploiement des outils de screening et de surveillance des transactions\n• Rédiger les spécifications fonctionnelles pour les systèmes de conformité\n• Assurer la veille réglementaire et anticiper les impacts SI\n• Collaborer avec les équipes Conformité, Juridique et Audit\n• Former les équipes métiers aux nouvelles procédures de conformité`,
      description: `GEEKFACT recrute un Chef de Projet AMOA Conformité pour piloter le renforcement de son dispositif de conformité réglementaire. Dans un contexte d\'exigences réglementaires croissantes, vous jouerez un rôle stratégique pour protéger le Groupe et maintenir la confiance de ses clients et régulateurs.`
    },
    {
      id: 'job-019', title: 'Chef de Projet AMOA CRM', department: 'Commercial', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'CRM, Salesforce, Microsoft Dynamics, Relation client, Marketing automation, Segmentation',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en AMOA CRM, gestion de projets relation client ou transformation commerciale, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets de déploiement et d\'évolution de la plateforme CRM\n• Recueillir et formaliser les besoins des équipes commerciales et marketing\n• Coordonner l\'intégration du CRM avec le CBS et les outils digitaux\n• Assurer la qualité des données clients dans le CRM\n• Piloter les projets de marketing automation et de personnalisation\n• Former et accompagner les équipes commerciales dans l\'adoption du CRM`,
      description: `Rejoignez GEEKFACT pour piloter la transformation de la relation client grâce à une plateforme CRM nouvelle génération. En tant que Chef de Projet AMOA CRM, vous travaillerez à l\'intersection du commercial, du marketing et de la technologie pour offrir aux clients une expérience bancaire personnalisée et différenciante.`
    },
    {
      id: 'job-020', title: 'Chef de Projet AMOA Paiement', department: 'Paiements', location: 'Casablanca', contract_type: 'CDI',
      experience: '6+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Paiement, SWIFT, Virement, Prélèvement, Instant Payment, Open Banking, PSD2',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 6 ans en AMOA paiements, moyens de paiement ou systèmes de paiement, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets d\'évolution des systèmes de paiement (virements, prélèvements, SWIFT)\n• Coordonner les projets d\'instant payment et de paiements cross-border\n• Rédiger les spécifications fonctionnelles pour les modules paiement du CBS\n• Assurer la conformité PSD2 et Open Banking\n• Gérer les relations avec les infrastructures de paiement (Bank Al-Maghrib, SIMT)\n• Suivre les indicateurs de performance et de disponibilité des systèmes de paiement`,
      description: `GEEKFACT recherche un Chef de Projet AMOA Paiement senior pour piloter l\'évolution de son infrastructure de paiements. Vous travaillerez sur des projets stratégiques qui façonneront l\'avenir des paiements bancaires en Afrique, avec un impact sur des millions de transactions quotidiennes.`
    },
    {
      id: 'job-021', title: 'Chef de Projet AMOA RH', department: 'Ressources Humaines', location: 'Casablanca', contract_type: 'CDI',
      experience: '4+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'SIRH, RH, Paie, Gestion des talents, Digital RH, Workday, SAP HCM, Formation',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience minimale de 4 ans en AMOA RH, digitalisation des processus RH ou gestion de projets SIRH, idéalement acquise dans le secteur bancaire ou au sein d\'un grand groupe.',
      missions: `• Piloter les projets de déploiement et d\'évolution du SIRH\n• Recueillir et formaliser les besoins des équipes RH (paie, formation, recrutement, mobilité)\n• Coordonner l\'intégration du SIRH avec les autres systèmes du Groupe\n• Assurer la conformité légale des modules paie et administration du personnel\n• Piloter les projets de digitalisation des processus RH\n• Accompagner la conduite du changement auprès des équipes RH`,
      description: `Rejoignez la Direction des Ressources Humaines de GEEKFACT pour piloter la transformation digitale des processus RH d\'un groupe bancaire panafricain. Vous aurez l\'opportunité de moderniser les outils RH et d\'améliorer l\'expérience des collaborateurs à l\'échelle du continent.`
    },
    {
      id: 'job-022', title: 'Chef de Projet AMOA Contrôle Permanent', department: 'Risques & Conformité', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'Contrôle permanent, Risques opérationnels, Audit interne, Plans de contrôle, Dispositif de maîtrise',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en AMOA contrôle permanent, gestion des risques ou conformité, idéalement acquise dans le secteur bancaire.',
      missions: `• Piloter les projets d\'évolution du dispositif de contrôle permanent\n• Coordonner le déploiement des outils de contrôle et de surveillance\n• Rédiger les spécifications fonctionnelles pour les systèmes de contrôle\n• Assurer la cohérence entre le référentiel de contrôles et les outils SI\n• Collaborer avec les équipes Risques, Conformité et Audit\n• Produire le reporting de contrôle permanent pour les instances de gouvernance`,
      description: `GEEKFACT recrute un Chef de Projet AMOA Contrôle Permanent pour piloter le renforcement de son dispositif de maîtrise des risques opérationnels. Vous jouerez un rôle clé dans la construction d\'une culture du contrôle solide au sein d\'un groupe bancaire ambitieux.`
    },
    {
      id: 'job-023', title: 'Chef de Projet AMOA Support', department: 'IT & Support', location: 'Casablanca', contract_type: 'CDI',
      experience: '5+ ans', education: 'Bac+5 Grande École d\'Ingénieurs',
      keywords: 'AMOA, Fonctions support, Transformation, Achats, Logistique, Gestion documentaire, ERP',
      profile: 'Titulaire d\'un Bac+5 issu d\'une grande école d\'ingénieurs, avec une expérience d\'au moins 5 ans en AMOA, conduite de projets de transformation ou déploiement de solutions sur les fonctions support, idéalement acquise dans le secteur bancaire ou financier.',
      missions: `• Piloter les projets de transformation des fonctions support (Achats, Logistique, Juridique, Communication)\n• Recueillir et formaliser les besoins des directions support\n• Coordonner le déploiement de solutions ERP et GED\n• Assurer la conduite du changement et la formation des équipes support\n• Suivre les indicateurs de performance des processus support\n• Contribuer à l\'optimisation et à l\'automatisation des processus administratifs`,
      description: `Rejoignez GEEKFACT pour piloter la modernisation des fonctions support d\'un groupe bancaire panafricain. En tant que Chef de Projet AMOA Support, vous aurez l\'opportunité de transformer les processus administratifs et opérationnels qui soutiennent la performance globale du Groupe.`
    }
  ];
}
