/**
 * Explicit install mode for manually typed source folders.
 */

import { z } from 'zod';

const MANUAL_INSTALL_AS = ['rules', 'commands', 'agents', 'skills'] as const;

export const manualInstallAsSchema = z.enum(MANUAL_INSTALL_AS);
export type ManualInstallAs = z.infer<typeof manualInstallAsSchema>;
