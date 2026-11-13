import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const entry = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().default(''),
  category: z.string().default(''),
  tags: z.array(z.string()).default([]),
  coverImage: z.string().default(''),
  coverAlt: z.string().default(''),
  displayDate: date,
  writtenAt: date,
  firstPublishedAt: date,
  externalUrl: z.string().default('')
});
export const collections = {
  writing: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/writing', generateId: ({ entry }) => entry.replace(/\.md$/, '') }), schema: entry }),
  projects: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/projects', generateId: ({ entry }) => entry.replace(/\.md$/, '') }), schema: entry })
};
