/**
 * AI Sources Service
 * Manages prompt template versioning and rollout
 */

import { prisma } from "../../lib/db";

export interface CreateAISourceVersionInput {
  promptTemplateId: string;
  name: string;
  content: string;
  model?: string;
  voice?: string;
  cachingPolicy?: string;
  createdBy?: string;
}

export interface UpdateAISourceVersionInput {
  name?: string;
  content?: string;
  model?: string;
  voice?: string;
  cachingPolicy?: string;
  rolloutPercent?: number;
  isTest?: boolean;
}

/**
 * Get all prompt templates with their versions
 */
export async function getAISourceTemplates() {
  try {
    // Prisma converts PascalCase model names to camelCase in the client
    // AISourcePromptTemplate -> aISourcePromptTemplate
    // Check if model exists in client
    if (!('aISourcePromptTemplate' in prisma)) {
      console.warn('[AI Sources] Prisma client not regenerated - models not available');
      return [];
    }
    return await (prisma as any).aISourcePromptTemplate.findMany({
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (err: any) {
    // Handle case where tables don't exist yet (migration not run) or client not regenerated
    const errMsg = err.message || String(err);
    if (errMsg.includes("does not exist") || errMsg.includes("Unknown model") || errMsg.includes("Cannot find model") || errMsg.includes("is not available")) {
      console.warn('[AI Sources] Models not available:', errMsg);
      return [];
    }
    throw err;
  }
}

/**
 * Get a specific prompt template with versions
 */
export async function getAISourceTemplate(id: string) {
  try {
    // Check if model exists in client
    if (!('aISourcePromptTemplate' in prisma)) {
      console.warn('[AI Sources] Prisma client not regenerated - models not available');
      return null;
    }
    return await (prisma as any).aISourcePromptTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
      },
    });
  } catch (err: any) {
    // Handle case where tables don't exist yet (migration not run) or client not regenerated
    const errMsg = err.message || String(err);
    if (errMsg.includes("does not exist") || errMsg.includes("Unknown model") || errMsg.includes("Cannot find model") || errMsg.includes("is not available")) {
      console.warn('[AI Sources] Models not available:', errMsg);
      return null;
    }
    throw err;
  }
}

/**
 * Create a new prompt template
 */
export async function createAISourceTemplate(data: {
  name: string;
  description?: string;
}) {
  return (prisma as any).aISourcePromptTemplate.create({
    data: {
      name: data.name,
      description: data.description,
      currentVersion: 1,
    },
  });
}

/**
 * Create a new version of a prompt template
 */
export async function createAISourceVersion(data: CreateAISourceVersionInput) {
  // Get the template to determine next version
  const template = await (prisma as any).aISourcePromptTemplate.findUnique({
    where: { id: data.promptTemplateId },
  });

  if (!template) {
    throw new Error("Prompt template not found");
  }

  const nextVersion = template.currentVersion + 1;

  // Create the new version
  const version = await (prisma as any).aISourceVersion.create({
    data: {
      promptTemplateId: data.promptTemplateId,
      version: nextVersion,
      name: data.name,
      content: data.content,
      model: data.model,
      voice: data.voice,
      cachingPolicy: data.cachingPolicy || "enabled",
      createdBy: data.createdBy,
      isTest: true, // New versions start as test versions
    },
  });

  // Update template's current version
  await (prisma as any).aISourcePromptTemplate.update({
    where: { id: data.promptTemplateId },
    data: { currentVersion: nextVersion },
  });

  return version;
}

/**
 * Update a version
 */
export async function updateAISourceVersion(
  id: string,
  data: UpdateAISourceVersionInput
) {
  return (prisma as any).aISourceVersion.update({
    where: { id },
    data: {
      name: data.name,
      content: data.content,
      model: data.model,
      voice: data.voice,
      cachingPolicy: data.cachingPolicy,
      rolloutPercent: data.rolloutPercent,
      isTest: data.isTest,
    },
  });
}

/**
 * Activate a version (deactivates others)
 */
export async function activateAISourceVersion(
  id: string,
  rolloutPercent: number = 100
) {
  const version = await (prisma as any).aISourceVersion.findUnique({
    where: { id },
    include: { promptTemplate: true },
  });

  if (!version) {
    throw new Error("Version not found");
  }

  // Deactivate all other versions of this template
  await (prisma as any).aISourceVersion.updateMany({
    where: {
      promptTemplateId: version.promptTemplateId,
      id: { not: id },
    },
    data: {
      isActive: false,
      rolloutPercent: 0,
    },
  });

  // Activate this version
  return (prisma as any).aISourceVersion.update({
    where: { id },
    data: {
      isActive: true,
      rolloutPercent,
      activatedAt: new Date(),
      isTest: false,
    },
  });
}

/**
 * Get the active version for a template (for use in production)
 */
export async function getActiveAISourceVersion(promptTemplateId: string) {
  return (prisma as any).aISourceVersion.findFirst({
    where: {
      promptTemplateId,
      isActive: true,
      isTest: false,
    },
    orderBy: { activatedAt: "desc" },
  });
}

