import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSafe } from './types/user-safe.type';
import { BaseService } from '../../common/services/base.service';
import * as bcrypt from 'bcrypt';
import { FilterUserDto } from './dto/filter-users.dto';
import { PaginatedResult, SortParam } from '../../common/dto/pagination.dto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { UploadService } from '../upload/upload.service';
import { UserCustomerGroupsService } from '../user_customer_groups/user_customer_groups.service';
import axios from 'axios';
import { ProductsService } from '../products/products.service';
import { Interaction, InteractionType } from '../interactions/entities/interaction.entity';

export interface TikiRecommendationItem {
  productId: number;
  score: number;
  rank: number;
}

export interface TikiRecommendationResponse {
  userId: number;
  recommendations: TikiRecommendationItem[];
  model?: string;
  count?: number;
}

// === Real-time Recommendation Types ===
export interface SessionEvent {
  item_id: number;
  action: 'view' | 'click' | 'add_to_cart' | 'purchase' | 'add_to_wishlist';
  timestamp?: number;
}

export interface RealtimeRecommendationItem {
  productId: number;
  score: number;
  rank: number;
  cluster?: number;
}

export interface RealtimeRecommendationResponse {
  userId: number;
  recommendations: RealtimeRecommendationItem[];
  sessionItems: number;
  topClusters: number[];
  isColdStart: boolean;
  count: number;
}

@Injectable()
export class UsersService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly uploadService: UploadService,
    private readonly userCustomerGroupsService: UserCustomerGroupsService,
    @InjectRepository(Interaction)
    private readonly interactionRepository: Repository<Interaction>,
    private readonly productService: ProductsService,
  ) {
    super(userRepository, 'user');
  }

  protected override getDefaultSorts(): SortParam[] {
    return [{ field: 'createdAt', direction: 'desc' }];
  }

  private sanitizeUser(user: User | null): UserSafe | null {
    if (!user) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, hashedRefreshToken, ...safeUser } = user;
    return safeUser;
  }

  private normalizeBirthdate(input?: string | Date | null): Date | null {
    if (input === undefined || input === null) {
      return null;
    }

    const normalizedInput = typeof input === 'string' ? input.trim() : input;

    if (!normalizedInput) {
      return null;
    }

    const date = normalizedInput instanceof Date ? normalizedInput : new Date(normalizedInput);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeGender(input?: string | null): string | null {
    if (!input) {
      return null;
    }
    const trimmed = input.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeAvatarFallback(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  async create(createUserDto: CreateUserDto, avatarFile?: UploadedFile): Promise<UserSafe> {
    const [existingUserByEmail, existingUserByPhone] = await Promise.all([
      this.userRepository.findOne({ where: { email: createUserDto.email } }),
      this.userRepository.findOne({ where: { phoneNumber: createUserDto.phoneNumber } }),
    ]);

    if (existingUserByEmail) {
      throw new ConflictException('Email đã tồn tại');
    }

    if (existingUserByPhone) {
      throw new ConflictException('Số điện thoại đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    if (createUserDto.role === UserRole.BRANCH_MANAGER || createUserDto.role === UserRole.STAFF) {
      if (!createUserDto.branchId) {
        throw new BadRequestException(
          'Branch assignment is required for staff and branch managers',
        );
      }
    }

    let avatarUrl = this.normalizeAvatarFallback(createUserDto.avatarUrl ?? null);
    if (avatarFile) {
      const uploadResult = await this.uploadService.uploadSingle(avatarFile, 'users/avatars');
      avatarUrl = uploadResult.url;
    }

    const newUser = this.userRepository.create({
      ...createUserDto,
      role: createUserDto.role ?? UserRole.CUSTOMER,
      branchId: createUserDto.branchId ?? null,
      password: hashedPassword,
      birthdate: this.normalizeBirthdate(createUserDto.birthdate),
      gender: this.normalizeGender(createUserDto.gender),
      avatarUrl,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Assign default rank 'Khách hàng mới'
    if (savedUser.role === UserRole.CUSTOMER) {
      await this.userCustomerGroupsService
        .assignRank(savedUser.id, 'Khách hàng mới')
        .catch((err) => {
          console.warn(`Failed to assign default rank to user ${savedUser.id}:`, err);
        });
    }

    const safeUser = this.sanitizeUser(savedUser);
    if (!safeUser) {
      throw new Error('Không thể khởi tạo người dùng mới');
    }
    return safeUser;
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    updaterId: number,
    avatarFile?: UploadedFile,
  ): Promise<UserSafe> {
    if (updaterId !== id) {
      throw new ForbiddenException('Bạn chỉ có thể cập nhật thông tin của chính mình');
    }

    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id ${id}`);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingByEmail = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConflictException('Email đã tồn tại');
      }
    }

    if (updateUserDto.phoneNumber && updateUserDto.phoneNumber !== user.phoneNumber) {
      const existingByPhone = await this.userRepository.findOne({
        where: { phoneNumber: updateUserDto.phoneNumber },
      });
      if (existingByPhone && existingByPhone.id !== id) {
        throw new ConflictException('Số điện thoại đã tồn tại');
      }
    }

    const targetRole = updateUserDto.role ?? user.role;
    const nextBranchId =
      updateUserDto.branchId !== undefined ? updateUserDto.branchId : (user.branchId ?? null);

    if (
      (targetRole === UserRole.BRANCH_MANAGER || targetRole === UserRole.STAFF) &&
      (nextBranchId === null || nextBranchId === undefined)
    ) {
      throw new BadRequestException('Branch assignment is required for staff and branch managers');
    }

    const nextBirthdate =
      updateUserDto.birthdate === undefined
        ? (user.birthdate ?? null)
        : this.normalizeBirthdate(updateUserDto.birthdate);

    const nextGender =
      updateUserDto.gender !== undefined
        ? this.normalizeGender(updateUserDto.gender)
        : (user.gender ?? null);

    let avatarUrl =
      updateUserDto.avatarUrl !== undefined
        ? this.normalizeAvatarFallback(updateUserDto.avatarUrl)
        : (user.avatarUrl ?? null);

    if (avatarFile) {
      const uploadResult = await this.uploadService.uploadSingle(avatarFile, 'users/avatars');
      avatarUrl = uploadResult.url;
    }

    const payload: Partial<User> = {
      ...updateUserDto,
      branchId: nextBranchId,
      birthdate: nextBirthdate,
      gender: nextGender,
      avatarUrl,
    };

    delete (payload as Partial<CreateUserDto>).password;

    const merged = this.userRepository.merge(user, payload);

    if (updateUserDto.password) {
      merged.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const savedUser = await this.userRepository.save(merged);
    const safeUser = this.sanitizeUser(savedUser);

    if (!safeUser) {
      throw new Error('Không thể cập nhật người dùng');
    }

    return safeUser;
  }

  async findOneByEmail(email: string): Promise<UserSafe | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    return this.sanitizeUser(user);
  }

  async findOneByEmailWithSecrets(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.password', 'user.hashedRefreshToken'])
      .where('user.email = :email', { email })
      .getOne();
  }

  async findOneById(id: number): Promise<UserSafe | null> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        participants: true,
        notificationTokens: true,
        userCustomerGroups: { customerGroup: true },
      },
    });
    return this.sanitizeUser(user);
  }

  async findOneByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.hashedRefreshToken')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setCurrentRefreshToken(refreshToken: string, userId: number): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, {
      hashedRefreshToken,
    });
  }

  async removeRefreshToken(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      hashedRefreshToken: null,
    });
  }

  async findAll(query: FilterUserDto): Promise<PaginatedResult<UserSafe>> {
    const { search, email, role, isActive, branchId, createdFrom, createdTo, phoneNumber } = query;

    const result = await this.paginate(query, (qb) => {
      qb.leftJoinAndSelect('user.participants', 'participants');

      if (search) {
        const like = `%${search.trim()}%`;
        qb.andWhere(
          'user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.phoneNumber ILIKE :search',
          { search: like },
        );
      }

      if (email) {
        qb.andWhere('user.email ILIKE :email', { email: `%${email.trim()}%` });
      }

      if (phoneNumber) {
        qb.andWhere('user.phoneNumber ILIKE :phone', { phone: `%${phoneNumber.trim()}%` });
      }

      if (role) {
        qb.andWhere('user.role = :role', { role });
      }

      if (typeof isActive === 'boolean') {
        qb.andWhere('user.isActive = :isActive', { isActive });
      }

      if (typeof branchId === 'number') {
        qb.andWhere('user.branchId = :branchId', { branchId });
      }

      this.applyDateFilter(qb, 'createdAt', createdFrom, createdTo);
    });

    const data = result.data
      .map((item) => this.sanitizeUser(item))
      .filter((user): user is UserSafe => Boolean(user));

    return {
      data,
      meta: result.meta,
    };
  }

  async getRecommendations(userId: number) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // console.log(user);

      const response = await axios.get<TikiRecommendationResponse>(
        'https://fashia-recommend-api.onrender.com/api/v1/recommendations',
        {
          params: {
            user_id: user.tikiId,
          },
        },
      );

      const data = response.data;
      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        return [];
      }

      const productIds = data.recommendations.map((rec) => rec.productId);
      console.log(productIds);

      if (productIds.length === 0) {
        return [];
      }

      const products = await this.productService.findByTikiIds(productIds);

      console.log(products);

      return products;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return [];
    }
  }

  /**
   * Get real-time hybrid recommendations based on recent interactions
   * Combines ALS long-term preferences with session-based short-term intent
   * Queries ALL interactions within the time window (cross-session)
   *
   * @param userId - User ID
   * @param timeWindowMinutes - Time window in minutes to query interactions (default: 30)
   * @param k - Number of recommendations to return (default: 10)
   */
  async getRealtimeRecommendations(userId: number, timeWindowMinutes: number = 30, k: number = 20) {
    try {
      console.log(userId);
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Query ALL recent interactions for this user (cross-session)
      const interactions = await this.interactionRepository.find({
        where: {
          idUser: userId,
        },
        order: { createdAt: 'ASC' }, // Oldest first, let ML handle time decay
        relations: ['product'],
      });

      console.log(`Found ${interactions.length} interactions in last ${timeWindowMinutes} minutes`);

      if (interactions.length > 0) {
        const sample = interactions[0];
        console.log('Sample interaction:', {
          id: sample.id,
          type: sample.type,
          productId: sample.idProduct,
          hasProduct: !!sample.product,
          tikiId: sample.product?.tikiId,
        });
      }

      // Map InteractionType to ML action format
      const interactionTypeToAction: Record<InteractionType, string> = {
        [InteractionType.VIEW]: 'view',
        [InteractionType.CLICK]: 'click',
        [InteractionType.ADD_TO_CART]: 'add_to_cart',
        [InteractionType.PURCHASE]: 'purchase',
        [InteractionType.ADD_TO_WISHLIST]: 'add_to_wishlist',
        [InteractionType.LIKE]: 'click',
        [InteractionType.UNLIKE]: 'view',
        [InteractionType.REMOVE_FROM_CART]: 'view',
        [InteractionType.REMOVE_FROM_WISHLIST]: 'view',
        [InteractionType.SHARE]: 'click',
        [InteractionType.SEARCH]: 'view',
        [InteractionType.FILTER]: 'view',
        [InteractionType.COMPARE]: 'click',
        [InteractionType.RATING]: 'purchase',
      };

      console.log(`[UsersService] Fetching recent interactions for user ${user.id || userId}...`);

      // Query interactions using the injected repository
      // ORDER: ASC so that most recent interaction is LAST (ML expects this)
      const recentInteractions = await this.interactionRepository.find({
        where: {
          idUser: userId,
        },
        order: { createdAt: 'ASC' }, // ASC: oldest first, newest LAST (ML requirement)
        relations: ['product'], // Need product to get tikiId for ML
      });
      console.log(`[UsersService] Found ${recentInteractions.length} raw interactions.`);

      // Convert to session events format for ML
      // IMPORTANT: Use tikiId (not idProduct) because ML model was trained on tikiId
      const sessionEvents: SessionEvent[] = recentInteractions
        .filter((i) => {
          const tikiId = i.product?.tikiId;
          return tikiId != null && +tikiId > 0;
        })
        .map((interaction) => ({
          item_id: +interaction.product.tikiId!, // Use tikiId for ML model
          action: interactionTypeToAction[interaction.type] as SessionEvent['action'],
          timestamp: interaction.createdAt.getTime(),
        }));

      console.log(`Converted ${sessionEvents.length} session events for ML`);
      if (sessionEvents.length > 0) {
        console.log(
          `[UsersService] Last event (most recent):`,
          sessionEvents[sessionEvents.length - 1],
        );
      }

      // Always call real-time endpoint (it handles empty sessions by falling back to ALS internally)
      const response = await axios.post<RealtimeRecommendationResponse>(
        'https://fashia-recommend-api.onrender.com/api/v1/recommendations/realtime',
        {
          user_id: user.tikiId ?? userId,
          session_events: sessionEvents,
          k: k,
          exclude_session_items: true,
          enable_cluster_boost: true,
        },
      );

      const data = response.data;

      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        return {
          products: [],
          metadata: {
            isColdStart: data.isColdStart,
            sessionItems: data.sessionItems,
            topClusters: data.topClusters,
            timeWindowMinutes: timeWindowMinutes,
          },
        };
      }

      const productIds = data.recommendations.map((rec) => rec.productId);

      if (productIds.length === 0) {
        return {
          products: [],
          metadata: {
            isColdStart: data.isColdStart,
            sessionItems: data.sessionItems,
            topClusters: data.topClusters,
            timeWindowMinutes: timeWindowMinutes,
          },
        };
      }

      // Fetch product details
      const products = await this.productService.findByTikiIds(productIds);

      // Attach scores and clusters to products
      const productsWithScores = products.map((product) => {
        const recItem = data.recommendations.find((rec) => rec.productId === product.tikiId);
        return {
          ...product,
          recommendationScore: recItem?.score ?? 0,
          cluster: recItem?.cluster,
        };
      });

      return {
        products: productsWithScores,
        metadata: {
          isColdStart: data.isColdStart,
          sessionItems: data.sessionItems,
          topClusters: data.topClusters,
          timeWindowMinutes: timeWindowMinutes,
        },
      };
    } catch (error) {
      console.error('Error fetching realtime recommendations:', error);
      return {
        products: [],
        metadata: {
          isColdStart: true,
          sessionItems: 0,
          topClusters: [],
          timeWindowMinutes: timeWindowMinutes,
        },
      };
    }
  }
}
