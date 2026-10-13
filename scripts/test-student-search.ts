/**
 * Focused Unit Test Suite for Student Search
 * Cairo University Faculty of Engineering (CUFE) - Student Financial Portal
 *
 * Verifies searchStudents and filterStudentSearchResults:
 * 1. Matches by student number (exact and partial, case-insensitive)
 * 2. Matches by Arabic full name (partial)
 * 3. Matches by English full name (case-insensitive partial)
 * 4. Matches by email (case-insensitive partial)
 * 5. Returns all records for empty, whitespace, or undefined query
 * 6. Returns empty array for non-matching query
 * 7. End-to-end execution of searchStudents in mock environment without network
 */

import { filterStudentSearchResults, searchStudents, type AdminStudentSearchResult } from '../src/lib/data/admin';

console.log('=================================================================');
console.log('RUNNING FOCUSED STUDENT SEARCH TEST SUITE');
console.log('=================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    console.log(`✅ PASS: ${name}${details ? ` -> ${details}` : ''}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${name}${details ? ` -> ${details}` : ''}`);
    failCount++;
  }
}

// Synthetic test dataset
const testStudents: AdminStudentSearchResult[] = [
  {
    id: 's1',
    studentNumber: 'DEMO-100001',
    nameAr: 'أحمد محمود علي',
    nameEn: 'Ahmed Mahmoud Ali',
    email: 'demo.student1@eng.cu.edu.eg',
    department: 'Computer & Systems Engineering',
    level: 3,
    currentSemesterDue: 15000,
    currentSemesterPaid: 10000,
    outstandingBalance: 5000,
    status: 'PARTIALLY_PAID',
  },
  {
    id: 's2',
    studentNumber: 'DEMO-100002',
    nameAr: 'سارة حسن إبراهيم',
    nameEn: 'Sara Hassan Ibrahim',
    email: 'demo.student2@eng.cu.edu.eg',
    department: 'Architectural Engineering',
    level: 4,
    currentSemesterDue: 12000,
    currentSemesterPaid: 12000,
    outstandingBalance: 0,
    status: 'PAID',
  },
  {
    id: 's3',
    studentNumber: 'DEMO-100003',
    nameAr: 'يوسف طارق المنشاوي',
    nameEn: 'Youssef Tarek El-Minshawy',
    email: 'demo.student3@eng.cu.edu.eg',
    department: 'Mechanical Power Engineering',
    level: 2,
    currentSemesterDue: 14000,
    currentSemesterPaid: 0,
    outstandingBalance: 14000,
    status: 'UNPAID',
  },
];

async function runTests() {
  // 1. Search by Student Number
  const resByNumber = filterStudentSearchResults(testStudents, '100001');
  assert(
    resByNumber.length === 1 && resByNumber[0].studentNumber === 'DEMO-100001',
    '1. Matches by student number (partial "100001")',
    `Matched: ${resByNumber[0]?.studentNumber}`
  );

  const resByFullNumber = filterStudentSearchResults(testStudents, 'demo-100002');
  assert(
    resByFullNumber.length === 1 && resByFullNumber[0].studentNumber === 'DEMO-100002',
    '2. Matches by student number case-insensitively ("demo-100002")',
    `Matched: ${resByFullNumber[0]?.studentNumber}`
  );

  // 2. Search by Arabic Name
  const resByArabicName = filterStudentSearchResults(testStudents, 'أحمد');
  assert(
    resByArabicName.length === 1 && resByArabicName[0].nameAr === 'أحمد محمود علي',
    '3. Matches by Arabic name ("أحمد")',
    `Matched: ${resByArabicName[0]?.nameAr}`
  );

  const resByArabicPartial = filterStudentSearchResults(testStudents, 'المنشاوي');
  assert(
    resByArabicPartial.length === 1 && resByArabicPartial[0].nameAr.includes('المنشاوي'),
    '4. Matches by Arabic partial family name ("المنشاوي")',
    `Matched: ${resByArabicPartial[0]?.nameAr}`
  );

  // 3. Search by English Name
  const resByEnglishName = filterStudentSearchResults(testStudents, 'sara');
  assert(
    resByEnglishName.length === 1 && resByEnglishName[0].nameEn === 'Sara Hassan Ibrahim',
    '5. Matches by English name case-insensitively ("sara")',
    `Matched: ${resByEnglishName[0]?.nameEn}`
  );

  const resByEnglishPartial = filterStudentSearchResults(testStudents, 'Tarek');
  assert(
    resByEnglishPartial.length === 1 && resByEnglishPartial[0].nameEn.includes('Tarek'),
    '6. Matches by English partial name ("Tarek")',
    `Matched: ${resByEnglishPartial[0]?.nameEn}`
  );

  // 4. Search by Email
  const resByEmail = filterStudentSearchResults(testStudents, 'demo.student1@eng.cu.edu.eg');
  assert(
    resByEmail.length === 1 && resByEmail[0].email === 'demo.student1@eng.cu.edu.eg',
    '7. Matches by full email ("demo.student1@eng.cu.edu.eg")',
    `Matched: ${resByEmail[0]?.email}`
  );

  const resByEmailPartial = filterStudentSearchResults(testStudents, 'student3');
  assert(
    resByEmailPartial.length === 1 && resByEmailPartial[0].email.includes('student3'),
    '8. Matches by partial email username ("student3")',
    `Matched: ${resByEmailPartial[0]?.email}`
  );

  // 5. Empty and Whitespace Queries
  const resUndefined = filterStudentSearchResults(testStudents, undefined);
  assert(
    resUndefined.length === testStudents.length,
    '9. Returns all students for undefined query',
    `Count: ${resUndefined.length}`
  );

  const resEmpty = filterStudentSearchResults(testStudents, '');
  assert(
    resEmpty.length === testStudents.length,
    '10. Returns all students for empty query ("")',
    `Count: ${resEmpty.length}`
  );

  const resWhitespace = filterStudentSearchResults(testStudents, '   ');
  assert(
    resWhitespace.length === testStudents.length,
    '11. Returns all students for whitespace-only query ("   ")',
    `Count: ${resWhitespace.length}`
  );

  // 6. Non-matching query
  const resNoMatch = filterStudentSearchResults(testStudents, 'nonexistent-student-xyz');
  assert(
    resNoMatch.length === 0,
    '12. Returns empty array for query with no matches',
    `Count: ${resNoMatch.length}`
  );

  // 7. End-to-end execution of searchStudents in mock environment (isolated)
  const origNodeEnv = process.env.NODE_ENV;
  const origDevMock = process.env.ENABLE_DEV_MOCKS;
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    // Force dev mock mode for searchStudents isolated check
    (process.env as any).NODE_ENV = 'development';
    process.env.ENABLE_DEV_MOCKS = 'true';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const mockSearchResults = await searchStudents('100001');
    assert(
      mockSearchResults.length >= 1 && mockSearchResults[0].studentNumber.includes('100001'),
      '13. searchStudents executes end-to-end in isolated mock environment',
      `Found: ${mockSearchResults.length} student(s)`
    );

    const mockSearchAll = await searchStudents(undefined);
    assert(
      mockSearchAll.length >= 5,
      '14. searchStudents returns all mock students when query is undefined',
      `Total mock students: ${mockSearchAll.length}`
    );
  } finally {
    (process.env as any).NODE_ENV = origNodeEnv;
    if (origDevMock !== undefined) {
      process.env.ENABLE_DEV_MOCKS = origDevMock;
    } else {
      delete process.env.ENABLE_DEV_MOCKS;
    }
    if (origUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    }
  }

  console.log('\n=================================================================');
  console.log(`TEST SUMMARY: ${passCount} passed, ${failCount} failed`);
  console.log('=================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
