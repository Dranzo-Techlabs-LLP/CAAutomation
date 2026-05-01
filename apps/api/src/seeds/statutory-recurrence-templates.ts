export interface StatutoryRecurrenceTemplate {
  code: string;
  name: string;
  serviceCode: string;
  patternType: 'monthly' | 'quarterly' | 'yearly';
  patternExpression: string;
  generateLeadDays: number;
  description: string;
}

export const statutoryRecurrenceTemplates: StatutoryRecurrenceTemplate[] = [
  { code: 'GSTR1_MONTHLY', name: 'GSTR-1 Monthly', serviceCode: 'GSTR1', patternType: 'monthly', patternExpression: 'day=11', generateLeadDays: 5, description: 'Due 11th of next month' },
  { code: 'GSTR1_QRMP', name: 'GSTR-1 QRMP', serviceCode: 'GSTR1', patternType: 'quarterly', patternExpression: 'monthAfterQuarterEndDay=13', generateLeadDays: 5, description: 'Due 13th after quarter end' },
  { code: 'GSTR3B_MONTHLY', name: 'GSTR-3B Monthly', serviceCode: 'GSTR3B', patternType: 'monthly', patternExpression: 'day=20', generateLeadDays: 5, description: 'Due 20th of next month' },
  { code: 'GSTR3B_QRMP', name: 'GSTR-3B QRMP', serviceCode: 'GSTR3B', patternType: 'quarterly', patternExpression: 'day=22', generateLeadDays: 5, description: 'Due 22nd/24th after quarter end' },
  { code: 'TDS_Q', name: 'TDS Quarterly Return', serviceCode: 'TDS_Q', patternType: 'quarterly', patternExpression: 'fixed=07-31,10-31,01-31,05-31', generateLeadDays: 10, description: 'Due 31 Jul, 31 Oct, 31 Jan, 31 May' },
  { code: 'TDS_PAYMENT_MONTHLY', name: 'TDS Payment Monthly', serviceCode: 'TDS_PAY', patternType: 'monthly', patternExpression: 'day=7', generateLeadDays: 3, description: 'Due 7th monthly' },
  { code: 'ADVANCE_TAX', name: 'Advance Tax', serviceCode: 'ADV_TAX', patternType: 'quarterly', patternExpression: 'fixed=06-15,09-15,12-15,03-15', generateLeadDays: 7, description: 'Due 15 Jun, 15 Sep, 15 Dec, 15 Mar' },
  { code: 'ITR_YEARLY', name: 'ITR Yearly', serviceCode: 'ITR', patternType: 'yearly', patternExpression: 'fixed=07-31,10-31', generateLeadDays: 30, description: 'Due 31 Jul or 31 Oct' },
  { code: 'ROC_AOC4', name: 'ROC AOC-4 Yearly', serviceCode: 'ROC_AOC4', patternType: 'yearly', patternExpression: 'agm+30', generateLeadDays: 20, description: 'Within 30 days of AGM' },
  { code: 'ROC_MGT7', name: 'ROC MGT-7 Yearly', serviceCode: 'ROC_MGT7', patternType: 'yearly', patternExpression: 'agm+60', generateLeadDays: 30, description: 'Within 60 days of AGM' },
  { code: 'PF_ESI_MONTHLY', name: 'PF & ESI Monthly', serviceCode: 'PF_ESI', patternType: 'monthly', patternExpression: 'day=15', generateLeadDays: 5, description: 'Due 15th monthly' },
  { code: 'PT_MONTHLY_YEARLY', name: 'Professional Tax', serviceCode: 'PT', patternType: 'monthly', patternExpression: 'state_specific', generateLeadDays: 7, description: 'Professional Tax by state cadence' },
];
