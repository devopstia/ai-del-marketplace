// Local demo only: adds 5 sample courses so catalogue layouts can be reviewed with more than one course.
// Lessons are short articles (no video). Every description says it is a sample course.
// Add:    docker compose exec -T api node - < scripts/demo-dummy-courses.cjs
// Remove: docker compose exec -T -e REMOVE=1 api node - < scripts/demo-dummy-courses.cjs
'use strict';
const { PrismaClient } = require('/app/apps/api/dist/generated/prisma/client.js');
const { PrismaPg } = require('@prisma/adapter-pg');

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to add sample courses in production');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const NOTE = '\n\n_Sample course for the local demo: lessons are short readings, not the full course._';
const art = (title, min, preview = false) => ({ title, min, preview });
const COURSES = [
  {
    slug: 'sample-mcp-servers-and-agents', owner: 'nadia@instructor.example', category: 'mcp-agents', level: 'intermediate', priceCents: 6999,
    title: 'Build MCP Servers and Agents for Your Platform',
    subtitle: 'Expose your runbooks, metrics and deploy tools to AI agents through the Model Context Protocol, safely',
    objectives: ['Write an MCP server in TypeScript', 'Give agents read-only and approved write tools', 'Log and review every agent action'],
    requirements: ['Comfortable with Node.js or Python', 'Basic Kubernetes knowledge'],
    sections: [
      { title: 'MCP in one afternoon', lectures: [art('What MCP solves for platform teams', 9, true), art('Your first MCP server: list deployments', 14)] },
      { title: 'Agents with guardrails', lectures: [art('Read-only tools first', 11), art('Approval steps for write actions', 13)] },
    ],
  },
  {
    slug: 'sample-gitops-argo-cd-ai-review', owner: 'courses@del.example', category: 'cicd-gitops', level: 'intermediate', priceCents: 5499,
    title: 'GitOps with Argo CD and AI Code Review',
    subtitle: 'Ship to Kubernetes from Git, then add an advisory AI reviewer to every pull request',
    objectives: ['Set up Argo CD app-of-apps', 'Promote releases across environments', 'Add an AI review step to CI'],
    requirements: ['A Kubernetes cluster (kind is fine)', 'GitHub account'],
    sections: [
      { title: 'GitOps foundations', lectures: [art('Why Git is the source of truth', 8, true), art('Argo CD app-of-apps', 15)] },
      { title: 'AI in the pipeline', lectures: [art('An advisory AI reviewer', 12), art('Keeping secrets out of prompts', 10)] },
    ],
  },
  {
    slug: 'sample-rag-on-bedrock-and-azure', owner: 'nadia@instructor.example', category: 'cloud-ai', level: 'advanced', priceCents: 7999,
    title: 'RAG on AWS Bedrock and Azure AI Search',
    subtitle: 'Build retrieval-augmented assistants over your own docs on both clouds, and measure their answers',
    objectives: ['Chunk and embed technical docs', 'Build RAG on Bedrock Knowledge Bases and Azure AI Search', 'Evaluate answers with a test set'],
    requirements: ['AWS or Azure account', 'Python basics'],
    sections: [
      { title: 'Retrieval that works', lectures: [art('How RAG answers from your docs', 10, true), art('Chunking runbooks and READMEs', 14)] },
      { title: 'Two clouds, one design', lectures: [art('Bedrock Knowledge Bases', 15), art('Azure AI Search', 15), art('Measuring answer quality', 12)] },
    ],
  },
  {
    slug: 'sample-prompting-for-engineers', owner: 'courses@del.example', category: 'ai-foundations', level: 'beginner', priceCents: 0,
    title: 'Prompt Engineering for DevOps Engineers',
    subtitle: 'Repeatable prompts for logs, incidents and infrastructure code, with checks you can trust',
    objectives: ['Structure prompts with role, context and format', 'Summarise logs and incidents', 'Review Terraform with AI, safely'],
    requirements: ['No AI experience needed'],
    sections: [
      { title: 'Prompts that repeat', lectures: [art('Role, context, constraints, format', 8, true), art('Summarising a noisy log', 9)] },
      { title: 'Prompts on the job', lectures: [art('Incident timelines from chat logs', 10), art('Reviewing Terraform plans', 11)] },
    ],
  },
  {
    slug: 'sample-n8n-ai-incident-workflows', owner: 'nadia@instructor.example', category: 'automation-n8n', level: 'intermediate', priceCents: 4999,
    title: 'AI Incident Workflows with n8n',
    subtitle: 'Turn alerts into triaged tickets, Slack summaries and safe runbook steps with n8n and an LLM',
    objectives: ['Build n8n workflows from alert webhooks', 'Summarise incidents with an LLM', 'Add human approval before any action'],
    requirements: ['A free n8n account or Docker', 'Basic JSON and HTTP knowledge'],
    sections: [
      { title: 'From alert to ticket', lectures: [art('Webhooks from Prometheus and Grafana', 9, true), art('Enriching alerts with context', 12)] },
      { title: 'AI in the loop', lectures: [art('LLM summaries your on-call will read', 11), art('Approval steps before runbook actions', 13)] },
    ],
  },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@del.example' } });
  if (process.env.REMOVE) {
    for (const c of COURSES) {
      const row = await prisma.course.findUnique({ where: { slug: c.slug } });
      if (!row) continue;
      if (await prisma.enrollment.count({ where: { courseId: row.id } })) {
        await prisma.course.update({ where: { id: row.id }, data: { status: 'unpublished' } });
        console.log(`unpublished (has enrolments): ${c.slug}`);
      } else {
        await prisma.course.delete({ where: { id: row.id } });
        console.log(`removed: ${c.slug}`);
      }
    }
    if (admin) await prisma.auditLog.create({ data: { actorId: admin.id, action: 'demo.sample_courses_removed', targetType: 'system', meta: { slugs: COURSES.map((c) => c.slug) } } });
    return;
  }
  for (const [i, c] of COURSES.entries()) {
    if (await prisma.course.findUnique({ where: { slug: c.slug } })) { console.log(`exists: ${c.slug}`); continue; }
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: c.owner } });
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: c.category } });
    const course = await prisma.course.create({
      data: {
        slug: c.slug, instructorId: owner.id, categoryId: category.id, title: c.title, subtitle: c.subtitle,
        description: `${c.subtitle}.${NOTE}`, level: c.level, priceCents: c.priceCents,
        objectives: c.objectives, requirements: c.requirements, status: 'published', publishedAt: new Date(Date.now() - (i + 1) * 3600_000),
      },
    });
    for (const [si, s] of c.sections.entries()) {
      const section = await prisma.section.create({ data: { courseId: course.id, title: s.title, position: si } });
      for (const [li, l] of s.lectures.entries()) {
        await prisma.lecture.create({
          data: { sectionId: section.id, title: l.title, position: li, type: 'article', isPreview: l.preview, durationSec: l.min * 60,
            articleMd: `## ${l.title}\n\nThis is a short reading in a sample course. The full lesson would cover this topic with a worked example and a lab.` },
        });
      }
    }
    console.log(`added: ${c.slug}`);
  }
  if (admin) await prisma.auditLog.create({ data: { actorId: admin.id, action: 'demo.sample_courses_added', targetType: 'system', meta: { slugs: COURSES.map((c) => c.slug) } } });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
