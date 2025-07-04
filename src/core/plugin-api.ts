import { Users } from '../users';
import { ArgumentsRegistry } from '../commands/arguments';
import { Commands } from '../commands';

export interface PluginApi {
  commands: Commands;
  argumentsRegistry: ArgumentsRegistry;
  users: Users;
}
