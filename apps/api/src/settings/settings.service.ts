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
    update: Partial<Pick<Firm, 'name' | 'gstin' | 'pan' | 'address' | 'stateCode' | 'logoUrl' | 'signatureUrl' | 'signatoryName' | 'signatoryDesignation' | 'settingsJson'>>,
    actorUserId: string,
  ): Promise<Firm> {
    const firm = await this.getFirm(firmId);
    if (update.name !== undefined) firm.name = update.name;
    if (update.gstin !== undefined) firm.gstin = update.gstin;
    if (update.pan !== undefined) firm.pan = update.pan;
    if (update.address !== undefined) firm.address = update.address;
    if (update.stateCode !== undefined) firm.stateCode = update.stateCode;
    if (update.logoUrl !== undefined) firm.logoUrl = update.logoUrl;
    if (update.signatureUrl !== undefined) firm.signatureUrl = update.signatureUrl;
    if (update.signatoryName !== undefined) firm.signatoryName = update.signatoryName;
    if (update.signatoryDesignation !== undefined) firm.signatoryDesignation = update.signatoryDesignation;
    if (update.settingsJson !== undefined) {
      firm.settingsJson = { ...(firm.settingsJson || {}), ...update.settingsJson };
    }
    firm.updatedBy = actorUserId;
    return this.firmRepository.save(firm);
  }
}
