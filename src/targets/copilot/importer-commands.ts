import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedCommandWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { COPILOT_PROMPTS_DIR, COPILOT_CANONICAL_COMMANDS_DIR } from './constants.js';
import { parseCommandPromptFrontmatter } from './command-prompt.js';

export async function importCopilotCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  promptsDirRel: string = COPILOT_PROMPTS_DIR,
): Promise<void> {
  const promptsDir = join(projectRoot, promptsDirRel);
  const destDir = join(projectRoot, COPILOT_CANONICAL_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: promptsDir,
      destDir,
      extensions: ['.prompt.md'],
      fromTool: 'copilot',
      normalize,
      mapEntry: async ({ srcPath, relativePath, content }) => {
        const previewRelativePath = relativePath.replace(/\.prompt\.md$/i, '.md');
        const previewDest = join(destDir, previewRelativePath);
        const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, previewDest));
        const command = parseCommandPromptFrontmatter(frontmatter, srcPath);
        const relDir = previewRelativePath.includes('/')
          ? previewRelativePath.slice(0, previewRelativePath.lastIndexOf('/'))
          : '';
        const fileName = `${command.name}.md`;
        const relativeCommandPath = relDir ? `${relDir}/${fileName}` : fileName;
        const destPath = join(destDir, relativeCommandPath);
        return {
          destPath,
          toPath: `${COPILOT_CANONICAL_COMMANDS_DIR}/${relativeCommandPath}`,
          feature: 'commands',
          content: await serializeImportedCommandWithFallback(
            destPath,
            {
              description: command.description,
              hasDescription: Object.prototype.hasOwnProperty.call(frontmatter, 'description'),
              allowedTools: command.allowedTools,
              hasAllowedTools:
                Object.prototype.hasOwnProperty.call(frontmatter, 'tools') ||
                Object.prototype.hasOwnProperty.call(frontmatter, 'x-agentsmesh-allowed-tools'),
            },
            body,
          ),
        };
      },
    })),
  );
}
