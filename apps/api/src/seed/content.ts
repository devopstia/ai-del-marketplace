export interface SeedLecture {
  title: string;
  type?: 'video' | 'article' | 'quiz';
  preview?: boolean;
  article?: string;
  captions?: boolean;
  resourceZip?: boolean;
  quiz?: { q: string; options: string[]; correct: number; why: string }[];
}
export interface SeedCourse {
  slug: string;
  owner: 'del' | 'nadia';
  category: string;
  title: string;
  subtitle: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  priceCents: number;
  objectives: string[];
  requirements: string[];
  colors: [string, string];
  tone: number;
  sections: { title: string; lectures: SeedLecture[] }[];
}

export const CATEGORIES = [
  { slug: 'ai-foundations', name: 'AI Foundations', icon: 'sparkles' },
  { slug: 'ai-for-devops', name: 'AI for DevOps', icon: 'bot' },
  { slug: 'cicd-gitops', name: 'CI/CD & GitOps', icon: 'git-branch' },
  { slug: 'mcp-agents', name: 'MCP & Agents', icon: 'network' },
  { slug: 'cloud-ai', name: 'Cloud AI (AWS & Azure)', icon: 'cloud' },
  { slug: 'automation-n8n', name: 'Automation (n8n)', icon: 'workflow' },
];

export const COURSES: SeedCourse[] = [
  {
    slug: 'ai-foundations-for-devops-engineers',
    owner: 'del',
    category: 'ai-foundations',
    title: 'AI Foundations for DevOps Engineers',
    subtitle: 'Tokens, context windows, prompts and hallucinations explained with everyday scenarios',
    description:
      'Start here. This course explains how large language models work in plain language, using real-life scenarios, and maps every idea to the terms you will meet on the job.\n\n- What a model, a token and a context window really are\n- Why models hallucinate, and how to check their answers\n- How to write prompts that give repeatable results',
    level: 'beginner',
    priceCents: 0,
    objectives: ['Explain tokens and context windows', 'Spot and prevent hallucinations', 'Write reusable prompts'],
    requirements: ['No AI experience needed', 'Basic command-line familiarity helps'],
    colors: ['0x1e3a8a', '0x0ea5e9'],
    tone: 440,
    sections: [
      {
        title: 'How language models think',
        lectures: [
          { title: 'Welcome: what you will build', preview: true, captions: true },
          { title: 'Tokens and context windows', preview: true },
          { title: 'Reading: a glossary you will keep', type: 'article', article: '## Glossary\n\n**Token**: a chunk of text the model reads.\n\n**Context window**: how many tokens fit in one request.\n\n**Hallucination**: a confident answer that is not true.' },
        ],
      },
      {
        title: 'Working safely with AI',
        lectures: [
          { title: 'Why models hallucinate' },
          {
            title: 'Check your understanding',
            type: 'quiz',
            quiz: [
              { q: 'A teammate pastes a 400-page runbook into a chat and the answer ignores the last chapter. What most likely happened?', options: ['The model is broken', 'The text exceeded the context window', 'The model refused the request', 'The runbook was encrypted'], correct: 1, why: 'Input beyond the context window is cut off, so the model never saw the last chapter.' },
              { q: 'An AI suggests a CLI flag you have never seen. What should you do first?', options: ['Run it in production', 'Check the official docs or --help', 'Ask the AI if it is sure', 'Ignore all AI output'], correct: 1, why: 'Verify against a primary source: models can invent plausible flags.' },
              { q: 'Which prompt gives the most repeatable result?', options: ['"Fix my pipeline"', '"Make it better"', 'A prompt with role, context, constraints and an output format', 'A single emoji'], correct: 2, why: 'Explicit role, context, constraints and format reduce ambiguity.' },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'ai-powered-cicd-with-github-actions',
    owner: 'del',
    category: 'cicd-gitops',
    title: 'AI-Powered CI/CD with GitHub Actions',
    subtitle: 'Add an advisory AI reviewer to your pipeline, safely and cheaply',
    description: 'Build a GitHub Actions workflow that asks an AI model to review every pull request, posts advisory comments and never blocks a merge on its own.\n\nEvery lesson ships a hands-on lab you can run on your own repository.',
    level: 'intermediate',
    priceCents: 4999,
    objectives: ['Build a PR review workflow', 'Keep API keys in repository secrets', 'Control cost with token budgets'],
    requirements: ['A GitHub account', 'Basic YAML'],
    colors: ['0x14532d', '0x22c55e'],
    tone: 523,
    sections: [
      { title: 'Pipeline basics', lectures: [{ title: 'The pipeline we are building', preview: true }, { title: 'Secrets and permissions', preview: true }] },
      { title: 'The AI reviewer', lectures: [{ title: 'Lab: an advisory review step', resourceZip: true }, { title: 'Cost and token budgets' }] },
    ],
  },
  {
    slug: 'build-mcp-servers-and-ai-agents',
    owner: 'del',
    category: 'mcp-agents',
    title: 'Build MCP Servers and AI Agents',
    subtitle: 'Give AI agents safe, audited access to your tools with the Model Context Protocol',
    description: 'Learn what the Model Context Protocol is, build a small MCP server that exposes read-only DevOps tools, and connect it to an agent that asks before it acts.',
    level: 'intermediate',
    priceCents: 5999,
    objectives: ['Explain MCP clients, servers and tools', 'Build a read-only MCP server', 'Design agents that ask before acting'],
    requirements: ['Node.js or Python basics'],
    colors: ['0x581c87', '0xa855f7'],
    tone: 587,
    sections: [
      { title: 'MCP in one picture', lectures: [{ title: 'Clients, servers and tools', preview: true }, { title: 'A real-life analogy', preview: true }] },
      { title: 'Build it', lectures: [{ title: 'Your first MCP server' }, { title: 'Agents that ask before they act' }] },
    ],
  },
  {
    slug: 'cloud-ai-on-aws-bedrock-and-azure',
    owner: 'del',
    category: 'cloud-ai',
    title: 'Cloud AI on AWS Bedrock and Azure AI Foundry',
    subtitle: 'What each service does, when to choose it, and how to call it from your apps',
    description: 'A practical tour of the managed AI services on AWS and Azure: model catalogues, guardrails, retrieval, pricing and the console screens you will actually use.',
    level: 'advanced',
    priceCents: 6999,
    objectives: ['Compare Bedrock and Azure AI Foundry', 'Call a model with least-privilege credentials', 'Estimate monthly cost'],
    requirements: ['An AWS account (free tier is enough)'],
    colors: ['0x7c2d12', '0xf97316'],
    tone: 659,
    sections: [
      { title: 'The landscape', lectures: [{ title: 'Managed AI services compared', preview: true }, { title: 'Console tour', preview: true }] },
      { title: 'Hands-on', lectures: [{ title: 'Calling a model from a container' }, { title: 'Clean up and cost check' }] },
    ],
  },
  {
    slug: 'n8n-automation-for-devops-teams',
    owner: 'nadia',
    category: 'automation-n8n',
    title: 'n8n Automation for DevOps Teams',
    subtitle: 'Self-hosted workflows that turn alerts into actions',
    description: 'Run n8n with Docker Compose and build workflows that route alerts, summarise incidents with a local model and post to your team chat.',
    level: 'beginner',
    priceCents: 3999,
    objectives: ['Run n8n with Docker Compose', 'Build an alert-routing workflow', 'Summarise incidents with a local model'],
    requirements: ['Docker installed'],
    colors: ['0x134e4a', '0x14b8a6'],
    tone: 698,
    sections: [
      { title: 'Getting started', lectures: [{ title: 'Why automate with n8n', preview: true }, { title: 'Install with Compose', preview: true }] },
      { title: 'Workflows', lectures: [{ title: 'Alert routing' }, { title: 'Incident summaries' }] },
    ],
  },
  {
    slug: 'aiops-monitoring-and-incident-response',
    owner: 'nadia',
    category: 'ai-for-devops',
    title: 'AIOps: Monitoring and Incident Response with LLMs',
    subtitle: 'Use language models to triage alerts without waking the whole team',
    description: 'Combine metrics, logs and a language model into an on-call assistant that explains alerts, suggests runbook steps and always leaves the final decision to a human.',
    level: 'intermediate',
    priceCents: 4499,
    objectives: ['Triage alerts with an LLM', 'Write runbooks an assistant can follow', 'Keep a human in the loop'],
    requirements: ['Some on-call experience helps'],
    colors: ['0x831843', '0xec4899'],
    tone: 784,
    sections: [
      { title: 'Foundations', lectures: [{ title: 'What AIOps really means', preview: true }, { title: 'Signals: metrics, logs, traces', preview: true }] },
      { title: 'The assistant', lectures: [{ title: 'Explaining an alert' }, { title: 'Human in the loop' }] },
    ],
  },
];

export const REVIEWERS = [
  { email: 'priya@student.example', name: 'Priya Natarajan' },
  { email: 'marco@student.example', name: 'Marco Rossi' },
  { email: 'lena@student.example', name: 'Lena Fischer' },
];

export const REVIEW_TEXT = [
  { rating: 5, body: 'Clear explanations and the labs actually run. Exactly what I needed for work.' },
  { rating: 4, body: 'Great pace and real examples. I would love one more advanced lab.' },
  { rating: 5, body: 'The everyday scenarios made the concepts click. Highly recommended.' },
];
