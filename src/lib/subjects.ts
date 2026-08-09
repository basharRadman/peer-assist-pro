import {
  Code2,
  Calculator,
  Cog,
  Languages,
  FlaskConical,
  Palette,
  BarChart3,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type Subject = {
  name: string;
  icon: LucideIcon;
  blurb: string;
};

export const SUBJECTS: Subject[] = [
  { name: "Programming", icon: Code2, blurb: "Python, JS, data structures, debugging" },
  { name: "Accounting", icon: Calculator, blurb: "Ledgers, IFRS, cost & audit" },
  { name: "Engineering", icon: Cog, blurb: "Mechanics, circuits, CAD, thermo" },
  { name: "Languages", icon: Languages, blurb: "Essays, grammar, translation, speaking" },
  { name: "Mathematics", icon: BarChart3, blurb: "Calculus, statistics, linear algebra" },
  { name: "Sciences", icon: FlaskConical, blurb: "Physics, chemistry, biology labs" },
  { name: "Design", icon: Palette, blurb: "UI/UX, Figma, portfolio critique" },
  { name: "Business & Law", icon: Scale, blurb: "Case studies, contracts, economics" },
];

export const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);

export const URGENCY_LABEL: Record<string, string> = {
  low: "No rush",
  normal: "This week",
  urgent: "Urgent",
};
