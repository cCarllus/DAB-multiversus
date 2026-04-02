import { closeDatabase, initializeDatabase, withTransaction } from '../lib/postgres';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from '../services/users.service';
import { PasswordService } from '../services/password.service';
import { SocialRepository } from '../repositories/social.repository';
import { SocialService } from '../services/social.service';

const DEV_ACCOUNT = {
  email: 'teste@dab.local',
  name: 'Teste',
  nickname: 'teste',
  password: 'SenhaForte123!',
} as const;

const DEMO_PLAYERS = [
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
    email: 'pami@dab.local',
    name: 'Pami',
    nickname: 'pami',
    presence: {
      currentActivity: 'Jogando partida ranqueada',
      status: 'online',
    },
    relation: 'accepted',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=33',
    email: 'sanya@dab.local',
    name: 'Sanya',
    nickname: 'sanya',
    presence: {
      currentActivity: 'No launcher',
      status: 'in_launcher',
    },
    relation: 'accepted',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=59',
    email: 'vex@dab.local',
    name: 'Vex',
    nickname: 'vex',
    presence: {
      status: 'offline',
    },
    relation: 'accepted',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=48',
    email: 'nyra@dab.local',
    name: 'Nyra',
    nickname: 'nyra',
    presence: {
      currentActivity: 'Aguardando squad',
      status: 'online',
    },
    relation: 'accepted',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=25',
    email: 'kael@dab.local',
    name: 'Kael',
    nickname: 'kael',
    presence: {
      currentActivity: 'Partida casual',
      status: 'online',
    },
    relation: 'accepted',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=54',
    email: 'iris@dab.local',
    name: 'Iris',
    nickname: 'iris',
    presence: {
      currentActivity: 'No launcher',
      status: 'online',
    },
    relation: 'accepted',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=67',
    email: 'mako@dab.local',
    name: 'Mako',
    nickname: 'mako',
    presence: {
      currentActivity: 'Explorando players',
      status: 'in_launcher',
    },
    relation: 'incoming',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=15',
    email: 'luna@dab.local',
    name: 'Luna',
    nickname: 'luna',
    presence: {
      currentActivity: 'Online',
      status: 'online',
    },
    relation: 'incoming',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=41',
    email: 'orca@dab.local',
    name: 'Orca',
    nickname: 'orca',
    presence: {
      status: 'offline',
    },
    relation: 'outgoing',
  },
  {
    avatarUrl: 'https://i.pravatar.cc/150?img=31',
    email: 'zeph@dab.local',
    name: 'Zeph',
    nickname: 'zeph',
    presence: {
      currentActivity: 'Em espera',
      status: 'online',
    },
    relation: 'outgoing',
  },
] as const;

type DemoRelation = (typeof DEMO_PLAYERS)[number]['relation'];

async function ensureDemoUser(
  usersRepository: UsersRepository,
  usersService: UsersService,
  passwordService: PasswordService,
  input: {
    avatarUrl: string;
    email: string;
    name: string;
    nickname: string;
    password?: string;
  },
) {
  const existing = await usersRepository.findByEmail(input.email);

  if (existing) {
    if (existing.profileImageUrl !== input.avatarUrl || existing.name !== input.name) {
      return usersRepository.updateProfile(existing.id, {
        name: input.name,
        profileImageUrl: input.avatarUrl,
      });
    }

    return existing;
  }

  const passwordHash = await passwordService.hashPassword(input.password ?? DEV_ACCOUNT.password);

  const createdUser = await usersService.createUser({
    email: input.email,
    name: input.name,
    nickname: input.nickname,
    passwordHash,
  });

  return usersRepository.updateProfile(createdUser.id, {
    profileImageUrl: input.avatarUrl,
  });
}

async function ensureRelationship(
  socialRepository: SocialRepository,
  currentUserId: string,
  otherUserId: string,
  relation: DemoRelation,
): Promise<void> {
  const existing = await socialRepository.findFriendshipBetweenUsers(currentUserId, otherUserId);

  if (relation === 'accepted') {
    if (!existing) {
      const created = await socialRepository.createFriendRequest(currentUserId, otherUserId);
      await socialRepository.updateFriendshipStatus(created.id, 'accepted');
      return;
    }

    if (existing.status !== 'accepted') {
      await socialRepository.updateFriendshipStatus(existing.id, 'accepted');
    }
    return;
  }

  const requesterUserId = relation === 'incoming' ? otherUserId : currentUserId;
  const addresseeUserId = relation === 'incoming' ? currentUserId : otherUserId;

  if (!existing) {
    await socialRepository.createFriendRequest(requesterUserId, addresseeUserId);
    return;
  }

  if (
    existing.status === 'pending' &&
    existing.requesterUserId === requesterUserId &&
    existing.addresseeUserId === addresseeUserId
  ) {
    return;
  }

  await socialRepository.deleteFriendship(existing.id);
  await socialRepository.createFriendRequest(requesterUserId, addresseeUserId);
}

async function main(): Promise<void> {
  await initializeDatabase();

  const usersRepository = new UsersRepository();
  const usersService = new UsersService(usersRepository);
  const passwordService = new PasswordService();
  const socialRepository = new SocialRepository();
  const socialService = new SocialService(socialRepository, usersService);

  const devUser = await ensureDemoUser(usersRepository, usersService, passwordService, {
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
    email: DEV_ACCOUNT.email,
    name: DEV_ACCOUNT.name,
    nickname: DEV_ACCOUNT.nickname,
    password: DEV_ACCOUNT.password,
  });

  await withTransaction(async (client) => {
    await socialService.updatePresence(
      devUser.id,
      {
        currentActivity: 'No launcher',
        status: 'in_launcher',
      },
      client,
    );
  });

  for (const demoPlayer of DEMO_PLAYERS) {
    const user = await ensureDemoUser(usersRepository, usersService, passwordService, {
      avatarUrl: demoPlayer.avatarUrl,
      email: demoPlayer.email,
      name: demoPlayer.name,
      nickname: demoPlayer.nickname,
    });

    await withTransaction(async (client) => {
      await socialService.updatePresence(
        user.id,
        {
          currentActivity:
            'currentActivity' in demoPlayer.presence
              ? demoPlayer.presence.currentActivity
              : undefined,
          status: demoPlayer.presence.status,
        },
        client,
      );
    });

    await ensureRelationship(socialRepository, devUser.id, user.id, demoPlayer.relation);
  }

  const accepted = DEMO_PLAYERS.filter((player) => player.relation === 'accepted').length;
  const incoming = DEMO_PLAYERS.filter((player) => player.relation === 'incoming').length;
  const outgoing = DEMO_PLAYERS.filter((player) => player.relation === 'outgoing').length;

  console.log(
    `Social demo seed ready for @${DEV_ACCOUNT.nickname}: ${DEMO_PLAYERS.length} players, ${accepted} friends, ${incoming} incoming requests, ${outgoing} outgoing requests.`,
  );
}

void main()
  .catch((error: unknown) => {
    console.error('Failed to seed social demo data.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => undefined);
  });
