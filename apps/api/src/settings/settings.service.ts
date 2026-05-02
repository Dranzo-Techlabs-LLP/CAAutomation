import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Firm } from '../common/entities/firm.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Firm)
    private readonly firmRepository: Repository<Firm>,
  ) {}

  async getFirm(firmId: string): Promise<Firm> {
    const firm = await this.firmRepository.findOne({ where: { id: firmId } });
    if (!firm) throw new NotFoundException('Firm not found');
    return firm;
  }

  async updateFirm(
    firmId: string,
    update: Partial<Pick<Firm, 'name' | 'gstin' | 'pan' | 'address' | 'logoUrl' | 'settingsJson'>>,
    actorUserId: string,
  ): Promise<Firm> {
    const firm = await this.getFirm(firmId);
    if (update.name !== undefined) firm.name = update.name;
    if (update.gstin !== undefined) firm.gstin = update.gstin;
    if (update.pan !== undefined) firm.pan = update.pan;
    if (update.address !== undefined) firm.address = update.address;
    if (update.logoUrl !== undefined) firm.logoUrl = update.logoUrl;
    if (update.settingsJson !== undefined) {
      firm.settingsJson = { ...(firm.settingsJson || {}), ...update.settingsJson };
    }
    firm.updatedBy = actorUserId;
    return this.firmRepository.save(firm);
  }
}
