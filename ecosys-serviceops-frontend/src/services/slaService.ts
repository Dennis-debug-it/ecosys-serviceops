import { tenantService } from './tenantService'
import { createId } from '../utils/id'
import type { SlaRuleRecord } from '../types/app'

export const slaService = {
  list(tenantId: string) {
    return tenantService.getTenantData(tenantId).slaRules
  },
  add(tenantId: string, input: Omit<SlaRuleRecord, 'id'>) {
    const rule: SlaRuleRecord = { ...input, id: createId('sla') }
    tenantService.updateTenantData(tenantId, (current) => ({ ...current, slaRules: [rule, ...current.slaRules] }))
    return rule
  },
  update(tenantId: string, ruleId: string, patch: Partial<SlaRuleRecord>) {
    tenantService.updateTenantData(tenantId, (current) => ({
      ...current,
      slaRules: current.slaRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }))
  },
}
