import { User } from '../entities/user.entity';

export type UserSafe = Omit<User, 'password' | 'hashedRefreshToken'>;
