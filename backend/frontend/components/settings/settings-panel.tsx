"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Paintbrush, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { settingsService } from "@/services/settings-service";
import { getApiErrorMessage } from "@/services/api-client";
import type { CompanySettings, EmailSettings, NumberingSettings } from "@/services/types";
import { useAccess } from "@/hooks/use-access";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorPanel } from "@/components/shared/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SettingsTab = "company" | "email" | "numbering";

const emptyCompanySettings: CompanySettings = {
  companyName: "",
  email: "",
  phone: "",
  country: "",
  industry: "",
  primaryColor: "#1d6b4d",
  secondaryColor: "#d9a516",
  showPoweredByEcosys: true,
};

const emptyEmailSettings: EmailSettings = {
  host: "",
  port: 25,
  useSsl: false,
  username: "",
  password: "",
  senderName: "",
  senderAddress: "",
};

const emptyNumberingForm = {
  branchId: "",
  documentType: "WorkOrder",
  prefix: "",
  nextNumber: "1",
  paddingLength: "6",
  resetFrequency: "Never",
  includeYear: false,
  includeMonth: false,
  isActive: true,
};

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const access = useAccess();
  const branches = useAuthStore((state) => state.branches).filter((branch) => branch.isActive);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [tab, setTab] = useState<SettingsTab>("company");
  const [companyForm, setCompanyForm] = useState<CompanySettings | null>(null);
  const [emailForm, setEmailForm] = useState<EmailSettings | null>(null);
  const [numberingBranchId, setNumberingBranchId] = useState(activeBranchId ?? "");
  const [numberingForm, setNumberingForm] = useState(emptyNumberingForm);

  const companyQuery = useQuery({
    queryKey: ["settings-company"],
    queryFn: () => settingsService.getCompany(),
    enabled: access.canManageSettings || access.isAdmin,
  });

  const emailQuery = useQuery({
    queryKey: ["settings-email"],
    queryFn: () => settingsService.getEmail(),
    enabled: access.canManageSettings || access.isAdmin,
  });

  const numberingQuery = useQuery({
    queryKey: ["settings-numbering", numberingBranchId],
    queryFn: () => settingsService.getNumbering(numberingBranchId || null),
    enabled: access.canManageSettings || access.isAdmin,
  });

  const companyValues = companyForm ?? companyQuery.data ?? emptyCompanySettings;
  const emailValues = emailForm ?? emailQuery.data ?? emptyEmailSettings;

  const companyMutation = useMutation({
    mutationFn: () => settingsService.updateCompany(companyValues),
    onSuccess: () => {
      toast.success("Company settings updated.");
      void queryClient.invalidateQueries({ queryKey: ["settings-company"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not save company settings.")),
  });

  const emailMutation = useMutation({
    mutationFn: () => settingsService.updateEmail(emailValues),
    onSuccess: () => {
      toast.success("Email settings updated.");
      void queryClient.invalidateQueries({ queryKey: ["settings-email"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not save email settings.")),
  });

  const numberingMutation = useMutation({
    mutationFn: () =>
      settingsService.updateNumbering({
        branchId: numberingForm.branchId || null,
        documentType: numberingForm.documentType,
        prefix: numberingForm.prefix,
        nextNumber: Number(numberingForm.nextNumber || 1),
        paddingLength: Number(numberingForm.paddingLength || 6),
        resetFrequency: numberingForm.resetFrequency,
        includeYear: numberingForm.includeYear,
        includeMonth: numberingForm.includeMonth,
        isActive: numberingForm.isActive,
      }),
    onSuccess: () => {
      toast.success("Numbering rule saved.");
      setNumberingForm(emptyNumberingForm);
      void queryClient.invalidateQueries({ queryKey: ["settings-numbering"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not save the numbering rule.")),
  });

  if (!access.canManageSettings && !access.isAdmin) {
    return (
      <EmptyState
        title="Settings access required"
        description="Your account does not currently include settings management inside this tenant."
      />
    );
  }

  const numberingRules = numberingQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Tune tenant branding, email delivery, and branch-aware numbering without leaving the ServiceOps shell."
      />

      <Card className="rounded-[28px] p-2">
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { key: "company", label: "Company" },
            { key: "email", label: "Email" },
            { key: "numbering", label: "Numbering" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as SettingsTab)}
              className={`rounded-[22px] px-4 py-3 text-sm font-semibold ${
                tab === item.key
                  ? "bg-[color:var(--tenant-primary)] text-white shadow-tenant"
                  : "bg-white/60 text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {tab === "company" ? (
        <Card className="rounded-[30px] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[color:var(--tenant-primary)]/10 p-3 text-[color:var(--tenant-primary)]">
              <Paintbrush className="h-6 w-6" />
            </div>
            <div>
              <h2 className="display-font text-2xl font-semibold text-slate-900">Company settings</h2>
              <p className="text-sm text-slate-600">Brand the workspace and keep company profile data current.</p>
            </div>
          </div>

          {companyQuery.isError ? <div className="mt-5"><ErrorPanel message={getApiErrorMessage(companyQuery.error, "We could not load company settings.")} /></div> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Company name</label>
              <Input value={companyValues.companyName} onChange={(event) => setCompanyForm({ ...companyValues, companyName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <Input type="email" value={companyValues.email} onChange={(event) => setCompanyForm({ ...companyValues, email: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Phone</label>
              <Input value={companyValues.phone ?? ""} onChange={(event) => setCompanyForm({ ...companyValues, phone: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Country</label>
              <Input value={companyValues.country} onChange={(event) => setCompanyForm({ ...companyValues, country: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Industry</label>
              <Input value={companyValues.industry ?? ""} onChange={(event) => setCompanyForm({ ...companyValues, industry: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Primary color</label>
                <Input type="color" value={companyValues.primaryColor} onChange={(event) => setCompanyForm({ ...companyValues, primaryColor: event.target.value })} className="h-14" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Secondary color</label>
                <Input type="color" value={companyValues.secondaryColor} onChange={(event) => setCompanyForm({ ...companyValues, secondaryColor: event.target.value })} className="h-14" />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Checkbox
              label="Show Powered by Ecosys"
              checked={companyValues.showPoweredByEcosys}
              onChange={(event) => setCompanyForm({ ...companyValues, showPoweredByEcosys: event.target.checked })}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => companyMutation.mutate()} disabled={companyMutation.isPending}>
              {companyMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save company settings"
              )}
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "email" ? (
        <Card className="rounded-[30px] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[color:var(--tenant-secondary)]/16 p-3 text-amber-700">
              <Settings2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="display-font text-2xl font-semibold text-slate-900">Email settings</h2>
              <p className="text-sm text-slate-600">Configure outbound mail delivery for notifications and tenant communications.</p>
            </div>
          </div>

          {emailQuery.isError ? <div className="mt-5"><ErrorPanel message={getApiErrorMessage(emailQuery.error, "We could not load email settings.")} /></div> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">SMTP host</label>
              <Input value={emailValues.host} onChange={(event) => setEmailForm({ ...emailValues, host: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Port</label>
              <Input type="number" value={emailValues.port} onChange={(event) => setEmailForm({ ...emailValues, port: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Username</label>
              <Input value={emailValues.username ?? ""} onChange={(event) => setEmailForm({ ...emailValues, username: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <Input type="password" value={emailValues.password ?? ""} onChange={(event) => setEmailForm({ ...emailValues, password: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Sender name</label>
              <Input value={emailValues.senderName} onChange={(event) => setEmailForm({ ...emailValues, senderName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Sender address</label>
              <Input type="email" value={emailValues.senderAddress} onChange={(event) => setEmailForm({ ...emailValues, senderAddress: event.target.value })} />
            </div>
          </div>

          <div className="mt-5">
            <Checkbox
              label="Use SSL/TLS"
              checked={emailValues.useSsl}
              onChange={(event) => setEmailForm({ ...emailValues, useSsl: event.target.checked })}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending}>
              {emailMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save email settings"
              )}
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "numbering" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <Card className="rounded-[30px] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="display-font text-2xl font-semibold text-slate-900">Current numbering rules</h2>
                <p className="mt-1 text-sm text-slate-600">Branch-specific rules override tenant-wide defaults automatically.</p>
              </div>
              <div className="w-full md:w-72">
                <Select value={numberingBranchId} onChange={(event) => setNumberingBranchId(event.target.value)}>
                  <option value="">Tenant-wide + visible branch rules</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {numberingQuery.isError ? <div className="mt-5"><ErrorPanel message={getApiErrorMessage(numberingQuery.error, "We could not load numbering rules.")} /></div> : null}

            <div className="mt-6 space-y-3">
              {numberingRules.length > 0 ? (
                numberingRules.map((rule: NumberingSettings) => (
                  <Card key={rule.id} className="rounded-[24px] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={rule.branchId ? "success" : "neutral"}>{rule.branchName ?? "Tenant default"}</Badge>
                          <Badge>{rule.documentType}</Badge>
                          <Badge tone={rule.isActive ? "success" : "warning"}>{rule.isActive ? "Active" : "Inactive"}</Badge>
                        </div>
                        <p className="mt-3 text-lg font-semibold text-slate-900">{rule.prefix}{rule.includeYear ? "-YYYY" : ""}{rule.includeMonth ? "-MM" : ""}-{String(rule.nextNumber).padStart(rule.paddingLength, "0")}</p>
                      </div>
                      <div className="text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-900">Reset:</span> {rule.resetFrequency}</p>
                        <p><span className="font-semibold text-slate-900">Padding:</span> {rule.paddingLength}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState title="No numbering rules yet" description="Create a tenant-wide rule or a branch-specific sequence to start generating consistent document numbers." />
              )}
            </div>
          </Card>

          <Card className="rounded-[30px] p-5 md:p-6">
            <h2 className="display-font text-2xl font-semibold text-slate-900">Create or update a rule</h2>
            <p className="mt-1 text-sm text-slate-600">Use branch-specific prefixes where you need separate number streams.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Branch</label>
                <Select value={numberingForm.branchId} onChange={(event) => setNumberingForm((current) => ({ ...current, branchId: event.target.value }))}>
                  <option value="">Tenant default</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Document type</label>
                <Select value={numberingForm.documentType} onChange={(event) => setNumberingForm((current) => ({ ...current, documentType: event.target.value }))}>
                  {["WorkOrder", "MaterialRequest", "Asset", "StockTransfer"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Prefix</label>
                <Input value={numberingForm.prefix} onChange={(event) => setNumberingForm((current) => ({ ...current, prefix: event.target.value }))} placeholder="KER-WO" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Next number</label>
                <Input type="number" min="1" value={numberingForm.nextNumber} onChange={(event) => setNumberingForm((current) => ({ ...current, nextNumber: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Padding length</label>
                <Input type="number" min="1" value={numberingForm.paddingLength} onChange={(event) => setNumberingForm((current) => ({ ...current, paddingLength: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Reset frequency</label>
                <Select value={numberingForm.resetFrequency} onChange={(event) => setNumberingForm((current) => ({ ...current, resetFrequency: event.target.value }))}>
                  {["Never", "Yearly", "Monthly"].map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Checkbox label="Include year" checked={numberingForm.includeYear} onChange={(event) => setNumberingForm((current) => ({ ...current, includeYear: event.target.checked }))} />
              <Checkbox label="Include month" checked={numberingForm.includeMonth} onChange={(event) => setNumberingForm((current) => ({ ...current, includeMonth: event.target.checked }))} />
              <Checkbox label="Rule is active" checked={numberingForm.isActive} onChange={(event) => setNumberingForm((current) => ({ ...current, isActive: event.target.checked }))} />
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => numberingMutation.mutate()} disabled={!numberingForm.prefix || numberingMutation.isPending}>
                {numberingMutation.isPending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save numbering rule"
                )}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
