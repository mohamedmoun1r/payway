import React from 'react';
import Link from 'next/link';
import { ShieldCheck, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminAuditLogs } from '@/lib/data/admin';

export default async function AdminAuditLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; from?: string; to?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { action = 'ALL', from, to } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  await requireAdmin(locale, `/${locale}/admin/audit-logs`);

  // 2. Fetch Filtered Immutable Audit Logs from DAL
  const logs = await getAdminAuditLogs({
    action,
    fromDate: from,
    toDate: to,
    limit: 100,
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PAYMENT_RECORDED':
        return <Badge variant="success">{isAr ? 'تسجيل سداد' : 'Payment Recorded'}</Badge>;
      case 'PAYMENT_VOIDED':
        return <Badge variant="destructive">{isAr ? 'إلغاء معاملة' : 'Payment Voided'}</Badge>;
      case 'AUTH_LOGIN_SUCCESS':
        return <Badge variant="info">{isAr ? 'تسجيل دخول ناجح' : 'Login Success'}</Badge>;
      case 'AUTH_LOGIN_FAILED':
        return <Badge variant="warning">{isAr ? 'فشل تسجيل دخول' : 'Login Failed'}</Badge>;
      case 'UNAUTHORIZED_ACCESS_ATTEMPT':
        return <Badge variant="destructive">{isAr ? 'محاولة وصول غير مصرح' : 'Access Denied'}</Badge>;
      case 'AUTH_LOGOUT':
        return <Badge variant="outline">{isAr ? 'تسجيل خروج' : 'Logout'}</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatStateDetails = (afterState: unknown, beforeState: unknown): string => {
    if (afterState && typeof afterState === 'object') {
      const stateObj = afterState as Record<string, unknown>;
      if (stateObj.void_reason) {
        return `${isAr ? 'السبب: ' : 'Reason: '}${stateObj.void_reason}`;
      }
      if (stateObj.amount && stateObj.txn_number) {
        return `${stateObj.txn_number} — ${stateObj.amount} EGP (Balance: ${stateObj.new_balance || 0})`;
      }
      if (stateObj.email) {
        return `${stateObj.email} (${stateObj.role || ''})`;
      }
      if (stateObj.attempted_identifier) {
        return `${stateObj.attempted_identifier}: ${stateObj.failure_reason}`;
      }
      if (stateObj.rejection_reason) {
        return `${stateObj.rejection_reason} [${stateObj.attempted_path || ''}]`;
      }
      return JSON.stringify(afterState).slice(0, 80);
    }
    if (beforeState && typeof beforeState === 'object') {
      return JSON.stringify(beforeState).slice(0, 80);
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{dict.admin.auditTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.admin.auditSubtitle}</p>
      </div>

      {/* 2. Institutional Compliance & Immutability Notice */}
      <Alert variant="info" icon={<ShieldCheck className="w-5 h-5 text-blue-800 shrink-0" />}>
        {isAr
          ? 'سجل التدقيق غير قابل للحذف أو التعديل برمجياً، ويوثق جميع العمليات الإدارية المنفذة على قاعدة البيانات لضمان الامتثال والشفافية المالية.'
          : 'The audit log is strictly immutable and permanently documents all financial and administrative actions for transparency and institutional compliance.'}
      </Alert>

      {/* 3. Filter Controls */}
      <Card className="p-4 sm:p-5">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              {dict.admin.filterByAction}
            </label>
            <select
              name="action"
              defaultValue={action}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="ALL">{dict.admin.allActions}</option>
              <option value="PAYMENT_RECORDED">PAYMENT_RECORDED</option>
              <option value="PAYMENT_VOIDED">PAYMENT_VOIDED</option>
              <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
              <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
              <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
              <option value="AUTH_LOGOUT">AUTH_LOGOUT</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              {dict.admin.fromDate}
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from || ''}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2 text-slate-700 h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              {dict.admin.toDate}
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to || ''}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2 text-slate-700 h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="h-[38px] flex-1">
              {dict.admin.searchQuery}
            </Button>

            {(action !== 'ALL' || from || to) && (
              <Link href={`/${locale}/admin/audit-logs`}>
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  className="h-[38px]"
                  icon={<X className="w-3.5 h-3.5" />}
                >
                  {dict.admin.clearFilter}
                </Button>
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* 4. Audit Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{dict.admin.auditTitle}</CardTitle>
              <CardDescription>
                {isAr
                  ? `أحدث الحركات المسجلة بالسجل: ${logs.length} عملية`
                  : `Showing latest ${logs.length} recorded events`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState
              title={dict.common.empty.noDataFound}
              description={
                isAr
                  ? 'لا توجد سجلات تدقيق مسجلة حتى الآن.'
                  : 'No audit logs recorded yet.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{dict.admin.auditTimestamp}</TableHead>
                    <TableHead>{dict.admin.auditActor}</TableHead>
                    <TableHead>{dict.admin.auditAction}</TableHead>
                    <TableHead>{dict.admin.auditEntity}</TableHead>
                    <TableHead>{dict.admin.auditDetails}</TableHead>
                    <TableHead>{dict.admin.auditIp}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const formattedDetails = formatStateDetails(log.after_state, log.before_state);
                    const formattedDate = new Date(log.created_at).toLocaleString();

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs text-slate-400">
                          {log.id}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                          {formattedDate}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">
                              {log.actor_role || 'SYSTEM'}
                            </span>
                          </div>
                          {log.actor_id && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {log.actor_id.slice(0, 8)}...
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-700">
                          <span className="text-slate-500 font-sans text-[11px] block">
                            {log.entity_name}
                          </span>
                          <span className="truncate max-w-[120px] block" title={log.entity_id}>
                            {log.entity_id}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 max-w-xs truncate" title={formattedDetails}>
                          {formattedDetails}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-500 whitespace-nowrap">
                          <div>{log.ip_address || '127.0.0.1'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[100px]" title={log.user_agent || ''}>
                            {log.user_agent ? log.user_agent.slice(0, 25) + '...' : '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
