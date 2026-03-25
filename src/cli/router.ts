// Command router

export type CommandHandler = (
  flags: Record<string, string | boolean>,
  args: string[],
) => Promise<void>;

export function createRouter(handlers: Record<string, CommandHandler>): {
  route: (cmd: string, flags: Record<string, string | boolean>, args: string[]) => Promise<void>;
  commands: () => string[];
} {
  const commands = Object.keys(handlers);

  return {
    async route(
      cmd: string,
      flags: Record<string, string | boolean>,
      args: string[],
    ): Promise<void> {
      const handler = handlers[cmd];
      if (handler) {
        await handler(flags, args);
        return;
      }
      throw new Error(`Unknown command "${cmd}". Available: ${commands.join(', ')}`);
    },
    commands: () => [...commands],
  };
}
