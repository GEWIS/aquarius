import { ArgumentsRegistry } from '../commands/arguments';
import { Commands } from '../commands';
import { Users } from '../modules/users/users';

export interface ModuleApi {
  commands: Commands;
  argumentsRegistry: ArgumentsRegistry;
  users: Users;
}
