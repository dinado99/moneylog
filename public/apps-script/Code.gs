/**
 * 머니로그 ↔ 낼나 가계부(구글 시트) 연결 스크립트
 *
 * 설치: 시트 메뉴 확장 프로그램 › Apps Script › 이 내용을 전부 붙여넣기 › TOKEN을 원하는 비밀번호로 바꾸기
 *       › 배포 › 새 배포 › 유형: 웹 앱, 실행: 나, 액세스: 모든 사용자 › 배포 › 웹 앱 URL 복사
 *       › 머니로그 앱 설정에 URL과 같은 비밀번호 입력
 *
 * 이 스크립트가 쓰는 곳: '가계부 기록' B~I열(날짜~출금계좌), '가계부 설정' 계좌표의 시작금액(T열, 자산 현황을
 * 맞출 때만), 'moneylog 규칙' 탭(없으면 만듦). 다른 칸과 수식은 건드리지 않는다.
 *
 * 스크립트를 바꾼 뒤에는 배포 › 배포 관리 › 연필 › 버전: 새 버전 › 배포 (URL은 그대로)
 */

const VERSION = 2;

const TOKEN = '여기에-비밀번호를-적어주세요';

const FIRST_ROW = 8; // '가계부 기록' 데이터 시작 행 (7행은 제목)
const LAST_ROW = 1037; // 시트 수식이 걸린 마지막 행
const COLS = 8; // B 날짜, C 구분, D 대분류, E 소분류, F 내용, G 금액, H 입금계좌, I 출금계좌

function doGet() {
  return json({ ok: true, app: 'moneylog' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: '잘못된 요청' });
  }
  if (req.token !== TOKEN) return json({ error: '비밀번호가 맞지 않아요' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (req.action === 'pull') return json(pull());
    if (req.action === 'push') return json(push(req.ops || []));
    if (req.action === 'saveRules') return json(saveRules(req.rules || []));
    if (req.action === 'adjustStart') return json(adjustStart(req.items || []));
    return json({ error: '알 수 없는 요청: ' + req.action });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheetByPrefix(prefix) {
  const sheet = SpreadsheetApp.getActive()
    .getSheets()
    .find(function (s) {
      return s.getName().indexOf(prefix) === 0;
    });
  if (!sheet) throw new Error("'" + prefix + "' 시트를 찾지 못했어요");
  return sheet;
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

function str(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** 날짜 칸 → 'yyyy-MM-dd' */
function fmtDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  const m = str(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? m[1] + '-' + pad(Number(m[2])) + '-' + pad(Number(m[3])) : str(v);
}

/** 한 줄을 앱과 똑같은 모양으로 정규화: [날짜, 구분, 대분류, 소분류, 내용, 금액, 입금계좌, 출금계좌] */
function norm(row) {
  const amount = row[5] === '' || row[5] === null ? '' : String(Number(row[5]));
  return [fmtDate(row[0]), str(row[1]), str(row[2]), str(row[3]), str(row[4]), amount, str(row[6]), str(row[7])];
}

function keyOf(row) {
  return JSON.stringify(norm(row));
}

function isBlank(row) {
  return row.every(function (c) {
    return c === '' || c === null;
  });
}

function blankRow() {
  return ['', '', '', '', '', '', '', ''];
}

/** 앱에서 온 정규화된 줄 → 시트 칸 값 */
function toCells(r) {
  return [r[0], r[1], r[2], r[3], r[4], r[5] === '' ? '' : Number(r[5]), r[6], r[7]];
}

function recordRange() {
  return sheetByPrefix('가계부 기록').getRange(FIRST_ROW, 2, LAST_ROW - FIRST_ROW + 1, COLS);
}

function pull() {
  const records = recordRange()
    .getValues()
    .filter(function (r) {
      return !isBlank(r);
    })
    .map(norm)
    .filter(function (r) {
      return r[0] && r[1] && r[5];
    });
  return { version: VERSION, records: records, settings: readSettings(), rules: readRules() };
}

/**
 * ops: [{op:'add', row}, {op:'update', match, row}, {op:'delete', match}]
 * match는 시트에 있던 줄의 keyOf 값. 다 바꾼 뒤 날짜순으로 정렬해서 빈 줄은 아래로 보낸다.
 */
function push(ops) {
  const range = recordRange();
  const vals = range.getValues();
  const keys = vals.map(keyOf);
  const results = [];

  function firstBlank() {
    for (let i = 0; i < vals.length; i++) if (isBlank(vals[i])) return i;
    return -1;
  }

  ops.forEach(function (op) {
    let i = op.match ? keys.indexOf(op.match) : -1;
    if (op.op === 'delete') {
      if (i >= 0) {
        vals[i] = blankRow();
        keys[i] = null;
      }
      results.push({ ok: true, missing: i < 0 });
      return;
    }
    // update인데 시트에서 이미 지워졌으면 새 줄로 넣는다 (앱에서 방금 고친 내용을 살림)
    if (i < 0) i = firstBlank();
    if (i < 0) {
      results.push({ ok: false, error: "'가계부 기록' 칸이 꽉 찼어요" });
      return;
    }
    vals[i] = toCells(op.row);
    keys[i] = keyOf(vals[i]);
    results.push({ ok: true });
  });

  const filled = vals.filter(function (r) {
    return !isBlank(r);
  });
  filled.sort(function (a, b) {
    return fmtDate(a[0]) < fmtDate(b[0]) ? -1 : fmtDate(a[0]) > fmtDate(b[0]) ? 1 : 0;
  });
  while (filled.length < vals.length) filled.push(blankRow());
  range.setValues(filled);
  return { results: results };
}

/** '가계부 설정'의 분류·계좌, '수입·지출 달력'의 일정 */
function readSettings() {
  const sheet = sheetByPrefix('가계부 설정');
  const last = sheet.getLastRow();
  const settings = {
    startYear: Number(sheet.getRange('C8').getValue()) || null,
    fiscalMonth: parseInt(str(sheet.getRange('C9').getValue()), 10) || 1,
    categories: [],
    accounts: [],
    schedules: [],
  };

  // 분류: B 구분, C 대분류(2행씩), 수입·지출 소분류는 E,G,I,K,M (왼쪽 칸이 고정 체크), 자산·부채 소분류는 D,F,H,J,L
  const grid = sheet.getRange(13, 2, Math.max(last - 12, 1), 12).getValues(); // B..M
  let section = '';
  let current = null;
  grid.forEach(function (row) {
    if (str(row[0])) section = str(row[0]);
    if (['자산', '부채', '수입', '지출'].indexOf(section) < 0) return;
    if (str(row[1])) {
      current = { kind: section, name: str(row[1]), subs: [] };
      settings.categories.push(current);
    }
    if (!current || current.kind !== section) return;
    const flow = section === '수입' || section === '지출';
    for (let c = flow ? 3 : 2; c <= 11; c += 2) {
      const name = str(row[c]);
      if (name) current.subs.push({ name: name, fixed: flow && row[c - 1] === true });
    }
  });

  // 계좌: O 정렬, P 구분, Q 대분류, R 소분류, S 이름, T 시작금액, U 메모, V 숨기기
  const accounts = sheet.getRange(13, 15, Math.max(last - 12, 1), 8).getValues();
  accounts.forEach(function (r) {
    if (!str(r[4]) || (str(r[1]) !== '자산' && str(r[1]) !== '부채')) return;
    settings.accounts.push({
      sort: Number(r[0]) || 0,
      kind: str(r[1]),
      category: str(r[2]),
      subcategory: str(r[3]),
      name: str(r[4]),
      start: Number(r[5]) || 0,
      memo: str(r[6]),
      hidden: r[7] === true,
    });
  });

  // 달력 일정: L 내용, M 날짜(일), N 주말인 경우(당기기/밀기)
  try {
    const cal = sheetByPrefix('수입·지출 달력').getRange('L7:N40').getValues();
    cal.forEach(function (r) {
      const day = Number(r[1]);
      if (str(r[0]) && day >= 1 && day <= 31) {
        settings.schedules.push({ name: str(r[0]), day: day, weekend: str(r[2]) === '당기기' || str(r[2]) === '밀기' ? str(r[2]) : null });
      }
    });
  } catch (err) {
    // 달력 시트가 없으면 일정 없이
  }
  return settings;
}

// ── 가져오기 규칙 ('moneylog 규칙' 탭: A 종류, B 원래 값, C 대분류 또는 계좌, D 소분류) ──

const RULE_SHEET = 'moneylog 규칙';
const RULE_TYPES = ['가맹점', '분류', '계좌'];

function ruleSheet(create) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(RULE_SHEET);
  if (!sheet && create) {
    sheet = ss.insertSheet(RULE_SHEET);
    sheet.getRange(1, 1, 1, 4).setValues([['종류', '원래 값', '대분류 / 계좌', '소분류']]);
    sheet.getRange(1, 6).setValue('머니로그 앱의 뱅크샐러드 가져오기 규칙. 종류: 가맹점(내용에 포함된 글자), 분류(뱅크샐러드 대분류 또는 대분류>소분류), 계좌(뱅크샐러드 결제수단 이름 → 시트 계좌)');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRules() {
  const sheet = ruleSheet(false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 4)
    .getValues()
    .filter(function (r) {
      return RULE_TYPES.indexOf(str(r[0])) >= 0 && str(r[1]) && str(r[2]);
    })
    .map(function (r) {
      return { type: str(r[0]), source: str(r[1]), category: str(r[2]), subcategory: str(r[3]) };
    });
}

/** rules: [{type, source, category, subcategory, remove}] — 같은 종류·원래 값이 있으면 바꾸고, 없으면 추가 */
function saveRules(rules) {
  const sheet = ruleSheet(true);
  const last = sheet.getLastRow();
  const vals = last >= 2 ? sheet.getRange(2, 1, last - 1, 4).getValues() : [];
  rules.forEach(function (r) {
    const i = vals.findIndex(function (v) {
      return str(v[0]) === r.type && str(v[1]) === r.source;
    });
    if (r.remove) {
      if (i >= 0) vals.splice(i, 1);
    } else if (i >= 0) {
      vals[i] = [r.type, r.source, r.category, r.subcategory || ''];
    } else {
      vals.push([r.type, r.source, r.category, r.subcategory || '']);
    }
  });
  if (last >= 2) sheet.getRange(2, 1, last - 1, 4).clearContent();
  if (vals.length) sheet.getRange(2, 1, vals.length, 4).setValues(vals);
  return { ok: true, rules: readRules() };
}

/** 자산 현황 맞추기: items [{name, delta}] — '가계부 설정' 계좌표에서 이름이 같은 첫 줄의 시작금액(T)에 delta를 더한다 */
function adjustStart(items) {
  const sheet = sheetByPrefix('가계부 설정');
  const last = sheet.getLastRow();
  const range = sheet.getRange(13, 19, Math.max(last - 12, 1), 2); // S 이름, T 시작금액
  const vals = range.getValues();
  const results = items.map(function (it) {
    const i = vals.findIndex(function (v) {
      return str(v[0]) === it.name;
    });
    if (i < 0) return { ok: false, error: it.name + ' 계좌를 찾지 못했어요' };
    vals[i][1] = (Number(vals[i][1]) || 0) + Number(it.delta);
    return { ok: true };
  });
  range.setValues(vals);
  return { results: results };
}
