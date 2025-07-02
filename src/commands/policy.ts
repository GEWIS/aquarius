import { env } from '../env';
import { TEAMS } from '../users';
import { CommandContext, CommandPolicy } from './index';

export const isAdmin: CommandPolicy = async (ctx: CommandContext): Promise<boolean> => {
  return Promise.resolve(ctx.msg.rawMessage.envelope.sourceUuid === env.ADMIN_UUID);
};

export const isTeam = async (ctx: CommandContext, team: TEAMS): Promise<boolean> => {
  if (await isAdmin(ctx)) return true;

  const teams = ctx.user?.teams;
  if (!teams) return false;

  return Promise.resolve(teams.has(team));
};

export const isABC: CommandPolicy = async (ctx: CommandContext): Promise<boolean> => {
  return isTeam(ctx, TEAMS.ABC);
};

export const isCBC: CommandPolicy = async (ctx: CommandContext): Promise<boolean> => {
  return isTeam(ctx, TEAMS.CBC);
};

export const isGuest: CommandPolicy = async (ctx: CommandContext): Promise<boolean> => {
  return (await isTeam(ctx, TEAMS.GUEST)) || (await isTeam(ctx, TEAMS.CBC)) || (await isTeam(ctx, TEAMS.ABC));
};
