import React from 'react';
import path from 'path';
import { Font, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatArabicForPdf, tafqeetCurrency } from './arabic-reshaper';

// Register Cairo Font from local assets
const fontRegular = path.join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf');
const fontBold = path.join(process.cwd(), 'public', 'fonts', 'Cairo-Bold.ttf');

Font.register({
  family: 'Cairo',
  fonts: [
    { src: fontRegular, fontWeight: 400 },
    { src: fontBold, fontWeight: 700 },
  ],
});

export interface ReceiptPdfData {
  receiptNumber: string;
  transactionNumber: string;
  issuedAt: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  paymentTime: string;
  referenceNumber?: string | null;
  notes?: string | null;
  status: string;
  studentNameAr: string;
  studentNameEn: string;
  studentNumber: string;
  academicProgram: string;
  academicDepartment: string;
  academicLevel: number;
  semesterNameAr: string;
  semesterNameEn: string;
  recordedByEmployeeId: string;
  qrDataUrl: string;
  verificationHash: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Cairo',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  watermarkBanner: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    marginBottom: 14,
    textAlign: 'center',
  },
  watermarkText: {
    fontSize: 8,
    color: '#92400e',
    fontWeight: 700,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 10,
    marginBottom: 12,
  },
  headerCol: {
    flex: 1,
  },
  headerTitleAr: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'right',
  },
  headerSubtitleAr: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'right',
    marginTop: 2,
  },
  headerTitleEn: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'left',
  },
  headerSubtitleEn: {
    fontSize: 8,
    color: '#475569',
    textAlign: 'left',
    marginTop: 2,
  },
  titleSection: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1e3a8a',
    textAlign: 'right',
  },
  receiptCode: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'left',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  sectionHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    color: '#334155',
    textAlign: 'right',
  },
  grid: {
    padding: 6,
  },
  gridRow: {
    flexDirection: 'row-reverse',
    marginBottom: 4,
  },
  gridCellHalf: {
    flex: 1,
    flexDirection: 'row-reverse',
  },
  label: {
    fontSize: 8.5,
    color: '#64748b',
    fontWeight: 700,
    marginLeft: 4,
    textAlign: 'right',
  },
  value: {
    fontSize: 8.5,
    color: '#0f172a',
    textAlign: 'right',
    flex: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#0f172a',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: 700,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
  },
  colDesc: { flex: 3 },
  colMethod: { flex: 2 },
  colAmount: { flex: 2, textAlign: 'left' },
  totalSection: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'right',
  },
  totalAmount: {
    fontSize: 13,
    fontWeight: 700,
    color: '#15803d',
    textAlign: 'left',
  },
  tafqeetText: {
    fontSize: 8.5,
    color: '#475569',
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 6,
  },
  qrContainer: {
    width: 70,
    height: 70,
    marginRight: 10,
  },
  qrImage: {
    width: 70,
    height: 70,
  },
  securityTextCol: {
    flex: 1,
    paddingLeft: 10,
  },
  securityTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#1e3a8a',
    textAlign: 'right',
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 7.5,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 1.3,
  },
  hashText: {
    fontSize: 6.5,
    fontFamily: 'Courier',
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 3,
  },
});

export const ReceiptPdfDocument: React.FC<{ data: ReceiptPdfData }> = ({ data }) => {
  const formattedAmount = `${Number(data.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${data.currency}`;
  const tafqeet = tafqeetCurrency(data.amount);

  return (
    <Document title={`CUFE-Receipt-${data.receiptNumber}`} author="Cairo University Faculty of Engineering">
      <Page size="A4" style={styles.page}>
        {/* 1. Pilot Demarcation Banner */}
        <View style={styles.watermarkBanner}>
          <Text style={styles.watermarkText}>
            {formatArabicForPdf('⚠️ بيئة تجريبية قبل الإنتاج — بيانات تجريبية فقط — لا توجد معاملات حقيقية')}
          </Text>
        </View>

        {/* Void Status Alert Banner */}
        {data.status === 'VOIDED' && (
          <View style={[styles.watermarkBanner, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
            <Text style={[styles.watermarkText, { color: '#991b1b', fontSize: 9 }]}>
              {formatArabicForPdf('⚠️ تنبيه رسمي: هذه المعاملة ملغاة رسمياً (VOIDED) — الإيصال لاغي ولا يعتد به كإثبات سداد')}
            </Text>
          </View>
        )}

        {/* 2. Bilingual University Header */}
        <View style={styles.header}>
          <View style={styles.headerCol}>
            <Text style={styles.headerTitleEn}>CAIRO UNIVERSITY</Text>
            <Text style={styles.headerSubtitleEn}>Faculty of Engineering</Text>
            <Text style={styles.headerSubtitleEn}>Treasury & Student Financial Affairs</Text>
          </View>
          <View style={styles.headerCol}>
            <Text style={styles.headerTitleAr}>{formatArabicForPdf('جامعة القاهرة')}</Text>
            <Text style={styles.headerSubtitleAr}>{formatArabicForPdf('كلية الهندسة — إدارة الشؤون المالية للطلاب')}</Text>
            <Text style={styles.headerSubtitleAr}>{formatArabicForPdf('خزينة الكلية')}</Text>
          </View>
        </View>

        {/* 3. Voucher Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.receiptCode}>{data.receiptNumber}</Text>
          <Text style={[styles.receiptBadge, data.status === 'VOIDED' ? { color: '#b91c1c' } : {}]}>
            {formatArabicForPdf(
              data.status === 'VOIDED'
                ? 'إيصال سداد ملغى رسمياً (VOIDED)'
                : 'إيصال سداد رسوم دراسية (رسمي)'
            )}
          </Text>
        </View>

        {/* 4. Student Information Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{formatArabicForPdf('بيانات الطالب')}</Text>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('اسم الطالب:')}</Text>
                <Text style={styles.value}>{formatArabicForPdf(data.studentNameAr)}</Text>
              </View>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('رقم القيد:')}</Text>
                <Text style={styles.value}>{data.studentNumber}</Text>
              </View>
            </View>

            <View style={styles.gridRow}>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('البرنامج الدراسي:')}</Text>
                <Text style={styles.value}>{formatArabicForPdf(data.academicProgram)}</Text>
              </View>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('القسم العلمي:')}</Text>
                <Text style={styles.value}>{formatArabicForPdf(data.academicDepartment)}</Text>
              </View>
            </View>

            <View style={styles.gridRow}>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('المستوى الدراسي:')}</Text>
                <Text style={styles.value}>{formatArabicForPdf(`المستوى ${data.academicLevel}`)}</Text>
              </View>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('الاسم بالإنجليزية:')}</Text>
                <Text style={styles.value}>{data.studentNameEn}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Financial Summary Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>{formatArabicForPdf('بيان الرسوم / الفصل الدراسي')}</Text>
            <Text style={[styles.tableHeaderText, styles.colMethod]}>{formatArabicForPdf('طريقة السداد')}</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>{formatArabicForPdf('المبلغ المسدد')}</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.colDesc}>
              <Text style={{ textAlign: 'right', fontSize: 8.5 }}>{formatArabicForPdf(data.semesterNameAr)}</Text>
              <Text style={{ textAlign: 'right', fontSize: 7.5, color: '#64748b', marginTop: 2 }}>
                {data.semesterNameEn}
              </Text>
              {data.referenceNumber && (
                <Text style={{ textAlign: 'right', fontSize: 7, color: '#64748b', marginTop: 1 }}>
                  {formatArabicForPdf(`رقم المرجع: ${data.referenceNumber}`)}
                </Text>
              )}
            </View>
            <View style={styles.colMethod}>
              <Text style={{ textAlign: 'right', fontSize: 8.5 }}>{formatArabicForPdf(data.paymentMethod)}</Text>
              <Text style={{ textAlign: 'right', fontSize: 7, color: '#64748b', marginTop: 2 }}>
                {`${data.paymentDate} ${data.paymentTime}`}
              </Text>
            </View>
            <View style={styles.colAmount}>
              <Text style={{ textAlign: 'left', fontWeight: 700, fontSize: 9 }}>{formattedAmount}</Text>
            </View>
          </View>
        </View>

        {/* 6. Total Amount & Tafqeet Section */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalAmount}>{formattedAmount}</Text>
            <Text style={styles.totalLabel}>{formatArabicForPdf('إجمالي المبلغ المسدد:')}</Text>
          </View>
          <Text style={styles.tafqeetText}>{formatArabicForPdf(tafqeet)}</Text>
        </View>

        {/* 7. Transaction Audit Details */}
        <View style={[styles.sectionCard, { marginBottom: 12 }]}>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('رقم المعاملة:')}</Text>
                <Text style={styles.value}>{data.transactionNumber}</Text>
              </View>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('حالة المعاملة:')}</Text>
                <Text
                  style={[
                    styles.value,
                    {
                      color: data.status === 'VOIDED' ? '#b91c1c' : '#15803d',
                      fontWeight: 700,
                    },
                  ]}
                >
                  {formatArabicForPdf(
                    data.status === 'VOIDED'
                      ? 'ملغاة رسمياً (VOIDED)'
                      : 'معتمدة ومسددة (COMPLETED)'
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('تاريخ الإصدار:')}</Text>
                <Text style={styles.value}>{new Date(data.issuedAt).toLocaleString('en-GB')}</Text>
              </View>
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>{formatArabicForPdf('المسؤول / الخزينة:')}</Text>
                <Text style={styles.value}>{data.recordedByEmployeeId}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 8. QR Verification & Cryptographic Security Footer */}
        <View style={styles.footer}>
          <View style={styles.qrContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.qrDataUrl} style={styles.qrImage} />
          </View>
          <View style={styles.securityTextCol}>
            <Text style={styles.securityTitle}>{formatArabicForPdf('التحقق الإلكتروني والخصوصية')}</Text>
            <Text style={styles.securityDesc}>
              {formatArabicForPdf(
                'هذا الإيصال مستند إلكتروني رسمي وموثق رقمياً عبر بوابة كلية الهندسة جامعة القاهرة. امسح رمز الاستجابة السريعة (QR) للتحقق الفوري من صحة السداد عبر النظام العام دون كشف بيانات الطالب الشخصية.'
              )}
            </Text>
            <Text style={styles.hashText}>
              HMAC-SHA256: {data.verificationHash.slice(0, 32)}...
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
