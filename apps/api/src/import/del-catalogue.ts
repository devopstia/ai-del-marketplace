/**
 * The DevOps Easy Learning catalogue: one course per category folder of the finished videos
 * (`ai-videos/projects/ai-devops/output/<NN-category>/`). Lecture titles, order and level come from the video plan
 * (branding/plan.mjs), lecture summaries from each tutorial's `subtitle`, quizzes from its `quizSet([...])`.
 * This file holds only what a person writes: course names, descriptions, outcomes, requirements and how lessons
 * group into sections. Any video not listed in a section is still imported (appended to the last section) with a
 * warning, so new videos are never silently dropped.
 *
 * Plan `description` fields are internal production notes and are never shown to learners.
 */
export interface CatalogueCourse {
  slug: string;
  category: string; // marketplace category slug (seeded)
  title: string;
  subtitle: string;
  description: string;
  objectives: string[];
  requirements: string[];
  free?: boolean;
  sections: { title: string; ids: string[] }[];
}

export const CATALOGUE: Record<string, CatalogueCourse> = {
  'before-ai': {
    slug: 'before-ai-how-computers-and-devops-worked',
    category: 'ai-foundations',
    title: 'Before AI: how computers and DevOps work without it',
    subtitle: 'Rules, runbooks and a short history, so you know exactly what AI changes',
    description:
      'Before you add AI to your work, see how problems were solved without it. You follow a support engineer who sorts thousands of emails with hand-written rules, fix a real 3 a.m. nginx outage the classic way (logs, config, docs, runbook), walk through the history of AI from expert systems to agents, and learn what machine learning really is with a spam filter.\n\nEvery idea is explained with an everyday scenario first and then mapped to the terms you will meet on the job.',
    objectives: [
      'Explain what rule-based programs do well and where they fail',
      'Troubleshoot a broken web server the classic way: reproduce, logs, config, docs, fix, runbook',
      'Describe the main steps in the history of AI, from rules to agents',
      'Explain training vs inference with a simple spam filter',
    ],
    requirements: ['No AI or IT background needed', 'Docker on your computer if you want to run the hands-on lab'],
    sections: [
      { title: 'Solving problems with rules', ids: ['computers-before-ai', 'devops-before-ai'] },
      { title: 'How AI arrived', ids: ['short-history-of-ai', 'what-is-machine-learning'] },
    ],
  },
  'ai-foundations': {
    slug: 'ai-foundations-the-vocabulary-of-ai',
    category: 'ai-foundations',
    title: 'AI Foundations: the vocabulary of AI',
    subtitle: 'Every word you need for AI work, explained with everyday scenarios',
    description:
      'Learning AI is like learning a new language: the vocabulary comes first. In twelve short lessons you learn the words you will hear in every AI conversation, from "model" and "token" to "embedding", "reranker", "agent loop", "quantisation" and "prompt injection", each one explained with a real-life scenario and then mapped to the technical term.\n\nEach lesson ends with a short quiz, and the course is free.',
    objectives: [
      'Tell AI, machine learning, deep learning and generative AI apart',
      'Explain prompts, tokens, context windows and temperature',
      'Describe how RAG prepares knowledge, finds it and answers with it',
      'Use the vocabulary of agents, model hosting and AI operations and security correctly',
    ],
    requirements: ['No AI experience needed'],
    free: true,
    sections: [
      { title: 'The big words', ids: ['tm1-big-words', 'tm2-practice-architecture-application', 'tm3-model-words'] },
      { title: 'Talking to a model and judging its answers', ids: ['tm4-talking-to-a-model', 'tm5-answer-quality'] },
      { title: 'RAG words', ids: ['tm6-rag-words-preparing', 'tm7-embeddings-vectors', 'tm8-rag-search-answer', 'tm9-where-data-lives'] },
      { title: 'Agents, running and operating AI', ids: ['tm10-agent-words', 'tm11-running-models', 'tm12-operating-securing'] },
    ],
  },
  'by-hand-vs-ai': {
    slug: 'by-hand-vs-with-ai-the-3am-outage',
    category: 'ai-for-devops',
    title: 'By hand vs. with AI: the 3 a.m. outage',
    subtitle: 'The same 502, diagnosed by an AI helper on Amazon Bedrock and fixed by the engineer',
    description:
      'A web server returns 502 in the middle of the night. You fix it with an AI helper on Amazon Bedrock: collect the evidence, redact secrets, give the model least-privilege access, check its answer, apply the fix and review the runbook it drafts. The lab ZIP lets you run the same outage on your own computer or a cheap cloud VM.',
    objectives: [
      'Collect and redact evidence before sending it to a model',
      'Call Amazon Bedrock with least-privilege, short-lived credentials',
      'Verify an AI diagnosis before you change anything',
      'Turn the fix into a reviewed runbook',
    ],
    requirements: ['Docker on your computer or a small cloud VM', 'An AWS account for Amazon Bedrock (the lab shows the setup)'],
    sections: [{ title: 'The outage, fixed with AI', ids: ['devops-with-ai'] }],
  },
  'agents-rag-ideas': {
    slug: 'agents-and-rag-the-ideas',
    category: 'mcp-agents',
    title: 'Agents and RAG: the ideas',
    subtitle: 'Skill-based DevOps agents and AI agents inside Kubernetes, explained before you build them',
    description:
      'An agent is a loop, a model, tools and limits. Learn how a skill-based DevOps agent does one job safely (allow-lists, real permissions, approval, verify, report), then see how kagent runs agents, models and MCP tools as Kubernetes resources.',
    objectives: [
      'Explain an agent as loop + model + tools + limits',
      'Design a skill with an allow-list, approval and a verify step',
      'Describe kagent: Agent and ModelConfig resources, MCP tool servers, investigator vs operator',
    ],
    requirements: ['The AI Foundations vocabulary helps', 'Basic Kubernetes ideas for the kagent lesson'],
    sections: [{ title: 'Agents that do one job safely', ids: ['s1-skill-based-agents', 'r10-kagent-explained'] }],
  },
  'building-rag': {
    slug: 'building-rag-one-architecture-three-implementations',
    category: 'ai-for-devops',
    title: 'Building RAG: one architecture, three implementations',
    subtitle: 'The same six RAG jobs on self-hosted Docker, Azure and AWS',
    description:
      'One recipe, three kitchens. Learn the six jobs every RAG system does and see each one mapped to self-hosted Docker, Azure and AWS services, so you can swap a part without changing the architecture and choose the right platform.',
    objectives: ['Name the six jobs of a RAG system', 'Map each job to Docker, Azure and AWS services', 'Choose a platform for your own RAG system'],
    requirements: ['The RAG words lessons of AI Foundations help'],
    sections: [{ title: 'One architecture, three platforms', ids: ['r7-one-architecture-three-implementations'] }],
  },
  'ai-production': {
    slug: 'ai-in-production-llmops-roles-and-hosting',
    category: 'ai-for-devops',
    title: 'AI in production: LLMOps, roles and hosting choices',
    subtitle: 'What you manage when an LLM app is live, who does it, and where it should run',
    description:
      'An LLM app in production needs more than a model. Learn what LLMOps manages every day (versions, evaluation, the knowledge lifecycle, prompts, cost and latency, feedback), who builds and who runs a RAG system with its four pipelines, and how to decide between managed cloud AI and self-hosting.',
    objectives: [
      'List what LLMOps manages day to day',
      'Split the work between developers, the platform team and the shared middle',
      'Decide between managed cloud AI and self-hosting with four questions',
    ],
    requirements: ['The AI Foundations vocabulary helps'],
    sections: [
      { title: 'Running an LLM app', ids: ['r1-llmops-day-to-day', 'r6-who-builds-who-runs'] },
      { title: 'Choosing where it runs', ids: ['r8-managed-or-self-hosted'] },
    ],
  },
  'cloud-labs': {
    slug: 'hands-on-cloud-ai-labs',
    category: 'cloud-ai',
    title: 'Hands-on cloud AI labs: chatbots, RAG and agents on AWS and Azure',
    subtitle: 'Nine live labs with the code: S3, Bedrock, Azure AI Foundry, RAG stacks and troubleshooting agents',
    description:
      'Nine labs recorded live in the AWS console, the Azure portal and VS Code. You publish a help site on S3, deploy a model in Azure AI Foundry, build an AI ops chatbot on Amazon Bedrock and a full-stack chat app on Microsoft Foundry, run a production-style RAG stack on Docker Compose, build complete RAG systems on Azure and AWS with Terraform, and run skill-based agents that find, fix, verify and report problems in Kubernetes and Docker.\n\nEvery lab ships as a ZIP you run on your own computer or a cheap cloud VM, with containers, a `.env.example` (bring your own key) and clean-up steps that delete only what you created.',
    objectives: [
      'Deploy and call models on Amazon Bedrock and Azure AI Foundry with least privilege',
      'Containerise an AI app with Docker Compose, keeping keys server-side',
      'Build complete RAG systems on Docker, Azure and AWS with Terraform',
      'Run troubleshooting agents with allow-lists, approval, verify and report',
      'Clean up cloud resources safely',
    ],
    requirements: [
      'Docker on your computer or a cloud VM',
      'An AWS account (free tier is enough for most labs); an Azure subscription for the Azure labs, or your own API key',
      'Comfort with a terminal',
    ],
    sections: [
      { title: 'First steps in the cloud', ids: ['s3-help-site-live'] },
      { title: 'Chatbots on Azure and AWS', ids: ['azure-foundry-model-live', 'bedrock-chatbot-live', 'foundry-chat-live'] },
      { title: 'RAG systems', ids: ['rag-stack-live', 'azure-rag-live', 'aws-rag-live'] },
      { title: 'Troubleshooting agents', ids: ['k8s-doctor-live', 's2-docker-skill-agents-live'] },
    ],
  },
  'cloud-ai': {
    slug: 'cloud-ai-services-explained-aws-and-azure',
    category: 'cloud-ai',
    title: 'Cloud AI services explained: AWS and Azure',
    subtitle: 'What each AI service is for, when to choose it, and where to find it in the console',
    description:
      'A clear map of the AI services on AWS and Azure before you build anything: every service family and what it is for, a decision guide (task service, foundation model or your own; prompt, RAG or fine-tune), then Amazon Bedrock and Azure AI Foundry in depth with console and portal tours.',
    objectives: [
      'Find the right AWS or Azure AI service for a DevOps task',
      'Choose between prompting, RAG and fine-tuning',
      'Explain how Amazon Bedrock and Azure AI Foundry work and compare them',
    ],
    requirements: ['No cloud AI experience needed', 'An AWS or Azure account if you want to follow the console tours'],
    sections: [
      { title: 'The maps', ids: ['aws-ai-services-map', 'azure-ai-services-map', 'choosing-ai-service'] },
      { title: 'Services in depth', ids: ['amazon-bedrock-explained', 'azure-ai-foundry-explained'] },
    ],
  },
};

/** Paid prices by total video length (DEL can change them later in the studio). */
export function priceForDuration(totalSec: number): number {
  const min = totalSec / 60;
  if (min < 20) return 2999;
  if (min < 40) return 3999;
  if (min < 75) return 4999;
  return 5999;
}

/** The demo DEL courses created by the seed; the import replaces them. */
export const DEMO_DEL_SLUGS = ['ai-foundations-for-devops-engineers', 'ai-powered-cicd-with-github-actions', 'build-mcp-servers-and-ai-agents', 'cloud-ai-on-aws-bedrock-and-azure'];
/** Seed reviewer accounts whose reviews were invented; the import removes those reviews (no fake ratings). */
export const FAKE_REVIEWER_EMAILS = ['priya@student.example', 'marco@student.example', 'lena@student.example'];

/**
 * Owner (2026-11-24): "one well structured course" — every DEL video is a lecture of ONE course, AI for DevOps, organised as
 * a learning path. Sections list video ids in teaching order; videos not finished yet are skipped with a warning and appear
 * automatically when they exist. The per-folder CATALOGUE above is kept only to remove those older separate courses.
 */
export const AI_FOR_DEVOPS: CatalogueCourse = {
  slug: 'ai-for-devops',
  category: 'ai-for-devops',
  title: 'AI for DevOps: from the vocabulary of AI to agents in production',
  subtitle: 'Learn AI the way DevOps engineers use it: every idea explained with a real-life scenario, then built in a hands-on lab',
  description:
    'A complete path for DevOps and cloud engineers who want to use AI with confidence. You start with how problems were solved before AI and the vocabulary every AI conversation uses, explained with everyday scenarios. Then you see what AI changes in real operations work, choose the right cloud AI service on AWS and Azure, understand agents and RAG, and learn what it takes to run an LLM application in production.\n\nThe second half is hands-on: live labs on AWS, Azure and Docker where you build chatbots on Amazon Bedrock and Azure AI Foundry, complete RAG systems with Terraform, and troubleshooting agents for Docker and Kubernetes. Every lab ships as a ZIP you run on your own computer or a cheap cloud VM, with clean-up steps that delete only what you created. Each lesson ends with a short quiz.',
  objectives: [
    'Use the vocabulary of AI correctly: models, tokens, context, embeddings, RAG, agents, hosting and AI security',
    'Choose the right AWS or Azure AI service, and decide between prompting, RAG and fine-tuning',
    'Build AI chatbots on Amazon Bedrock and Azure AI Foundry with least privilege and keys kept server-side',
    'Build complete RAG systems on Docker, Azure and AWS with Terraform',
    'Run troubleshooting agents with allow-lists, human approval, verification and reports',
    'Operate LLM applications: versions, evaluation, knowledge freshness, cost and security',
  ],
  requirements: [
    'No AI experience needed: the course starts from the basics',
    'Comfort with a terminal for the labs',
    'Docker on your computer or a cloud VM; an AWS account (free tier is enough for most labs); Azure only for the Azure labs, or your own API key',
  ],
  sections: [
    { title: 'Before AI: how problems were solved', ids: ['computers-before-ai', 'devops-before-ai', 'short-history-of-ai', 'what-is-machine-learning'] },
    { title: 'AI vocabulary: the big words', ids: ['tm1-big-words', 'tm2-practice-architecture-application', 'tm3-model-words'] },
    { title: 'AI vocabulary: talking to a model and judging its answers', ids: ['tm4-talking-to-a-model', 'tm5-answer-quality'] },
    { title: 'AI vocabulary: RAG', ids: ['tm6-rag-words-preparing', 'tm7-embeddings-vectors', 'tm8-rag-search-answer', 'tm9-where-data-lives'] },
    { title: 'AI vocabulary: agents, running and securing AI', ids: ['tm10-agent-words', 'tm11-running-models', 'tm12-operating-securing'] },
    { title: 'By hand vs. with AI', ids: ['devops-with-ai'] },
    { title: 'Cloud AI services on AWS and Azure', ids: ['aws-ai-services-map', 'azure-ai-services-map', 'choosing-ai-service', 'amazon-bedrock-explained', 'azure-ai-foundry-explained'] },
    { title: 'Agents and RAG: the ideas', ids: ['s1-skill-based-agents', 'r10-kagent-explained', 'r7-one-architecture-three-implementations'] },
    { title: 'AI in production', ids: ['r1-llmops-day-to-day', 'r6-who-builds-who-runs', 'r8-managed-or-self-hosted'] },
    { title: 'Lab: first steps in the cloud', ids: ['s3-help-site-live'] },
    { title: 'Lab: AI chatbots on Azure and AWS', ids: ['azure-foundry-model-live', 'bedrock-chatbot-live', 'foundry-chat-live'] },
    { title: 'Lab: RAG systems', ids: ['rag-stack-live', 'azure-rag-live', 'aws-rag-live'] },
    { title: 'Lab: troubleshooting agents', ids: ['k8s-doctor-live', 's2-docker-skill-agents-live'] },
    { title: 'Automation with n8n and Mattermost', ids: ['n1-n8n-mattermost-explained', 'n2-deploy-n8n-mattermost-live'] },
    { title: 'AI in CI/CD pipelines', ids: ['ci1-ai-in-cicd'] },
    { title: 'Model Context Protocol (MCP)', ids: ['m1-what-is-mcp', 'm2-inside-mcp'] },
    { title: 'Claude Code: its files and settings', ids: ['cc1-claude-md-in-depth'] },
  ],
};

/** Default price of the single course (DEL can change it in the studio). */
export const AI_FOR_DEVOPS_PRICE_CENTS = 8999;
/** Free previews: the first lecture of each of these sections (a taste of every part of the course). */
export const AI_FOR_DEVOPS_PREVIEW_SECTIONS = ['Before AI: how problems were solved', 'AI vocabulary: the big words', 'Cloud AI services on AWS and Azure', 'Lab: AI chatbots on Azure and AWS'];
