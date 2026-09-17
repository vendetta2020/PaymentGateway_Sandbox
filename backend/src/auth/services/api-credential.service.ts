import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { ApiCredential } from '../entities/api-credential.entity';
import { ApiCredentialStatus } from '../enums/api-credential-status.enum';
import { Merchant } from '../../merchant/entities/merchant.entity';

export interface GeneratedCredential {
  credentialId: string;
  publicKey: string;
  plaintextSecret: string;
}

@Injectable()
export class ApiCredentialService {
  constructor(
    @InjectRepository(ApiCredential)
    private readonly apiCredentialRepository: Repository<ApiCredential>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  /**
   * Generates a new API credential for a merchant.
   * Format: sk_test_<publicKey>_<randomSecret>
   * Only the hash of the secret is stored.
   */
  async createCredential(merchantId: string): Promise<GeneratedCredential> {
    const merchant = await this.merchantRepository.findOne({ where: { id: merchantId } });
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    const publicKey = randomBytes(16).toString('hex');
    const randomSecret = randomBytes(32).toString('hex');
    const plaintextSecret = `sk_test_${publicKey}_${randomSecret}`;

    const secretHash = this.hashSecret(plaintextSecret);

    const credential = this.apiCredentialRepository.create({
      merchantId,
      publicKey,
      secretHash,
      status: ApiCredentialStatus.ACTIVE,
    });

    await this.apiCredentialRepository.save(credential);

    return {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      plaintextSecret,
    };
  }

  /**
   * Finds an active credential by its public key.
   */
  async findActiveByPublicKey(publicKey: string): Promise<ApiCredential | null> {
    return this.apiCredentialRepository.findOne({
      where: {
        publicKey,
        status: ApiCredentialStatus.ACTIVE,
      },
      relations: { merchant: true },
    });
  }

  /**
   * Verifies a plaintext secret against a stored hash using constant-time comparison.
   */
  verifySecret(plaintextSecret: string, storedHash: string): boolean {
    try {
      const hash = this.hashSecret(plaintextSecret);
      const hashBuffer = Buffer.from(hash, 'hex');
      const storedHashBuffer = Buffer.from(storedHash, 'hex');

      if (hashBuffer.length !== storedHashBuffer.length) {
        return false;
      }

      return timingSafeEqual(hashBuffer, storedHashBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Lists all credentials for a merchant, strictly omitting secret hashes.
   */
  async listCredentials(merchantId: string): Promise<Omit<ApiCredential, 'secretHash'>[]> {
    return this.apiCredentialRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        merchantId: true,
        publicKey: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Revokes an API credential for a merchant.
   */
  async revokeCredential(
    merchantId: string,
    credentialId: string,
  ): Promise<Omit<ApiCredential, 'secretHash'>> {
    const credential = await this.apiCredentialRepository.findOne({
      where: { id: credentialId, merchantId },
    });

    if (!credential) {
      throw new NotFoundException(`API credential with ID ${credentialId} not found`);
    }

    credential.status = ApiCredentialStatus.REVOKED;
    await this.apiCredentialRepository.save(credential);

    const safeCredential = { ...credential };
    delete (safeCredential as Partial<ApiCredential>).secretHash;
    return safeCredential as Omit<ApiCredential, 'secretHash'>;
  }

  /**
   * Hashes a high-entropy secret using SHA-256.
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
