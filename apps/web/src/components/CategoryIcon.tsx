import { Bot, Brain, Cloud, GitBranch, Layers, Workflow, Zap, type LucideIcon } from "lucide-react";

const byKey: [RegExp, LucideIcon][] = [
  [/mcp|agent/i, Bot],
  [/foundation|brain|ml/i, Brain],
  [/cloud|aws|azure/i, Cloud],
  [/ci|cd|git/i, GitBranch],
  [/automat|n8n|zap/i, Zap],
  [/devops|workflow/i, Workflow],
];

export function categoryIcon(slugOrName: string, icon?: string | null): LucideIcon {
  for (const [re, I] of byKey) if (re.test(icon ?? "") || re.test(slugOrName)) return I;
  return Layers;
}
