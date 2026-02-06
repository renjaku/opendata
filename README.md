# Renjaku/Open Data

連雀株式会社では、公的な書類を構造化データに変換し、オープンデータとして提供しています。
この取り組みは、プログラムによる活用を目的としています。

主なデータと格納場所は、次の通りです。

データ名|場所
-|-
厚生年金|[フォルダ](public/v1/jp/pension)
健康保険|[フォルダ](public/v1/jp/health-insurance)
雇用保険|[フォルダ](public/v1/jp/employment-insurance)
源泉所得税|[フォルダ](public/v1/jp/withholding-tax)

## API

API エンドポイントは `https://opendata.renjaku.co.jp` です。

リポジトリ内のソースファイルは [build.js](build.js) により API リソースとして公開されます。
基本的なルールとして YAML ソースは JSON ファイルに変換されます。

具体的なソースと API リソースの関係は、次の表を参考にして下さい。

ソース|API
-|-
[public/v1/jp/pension/remuneration-tables/2016-10-01.yaml](public/v1/jp/pension/remuneration-tables/2016-10-01.yaml)|[https://opendata.renjaku.co.jp/v1/jp/pension/remuneration-tables/2016-10-01.json](https://opendata.renjaku.co.jp/v1/jp/pension/remuneration-tables/2016-10-01.json)

## 社会保険料額表の取得手順

最初に[標準報酬月額表の一覧を取得](https://opendata.renjaku.co.jp/v1/jp/pension/remuneration-tables.json)してから、目当ての月額表を取得します。

```sh
# 最初に標準報酬月額表の一覧を取得
curl https://opendata.renjaku.co.jp/v1/jp/pension/remuneration-tables.json

# 現在日時をもとに目当ての月額表を特定
TARGET=2020-09-01

# 目当ての月額表を取得
curl https://opendata.renjaku.co.jp/v1/jp/pension/$TARGET.json
```

JavaScript の場合:

```javascript
const API_ENDPOINT = 'https://opendata.renjaku.co.jp/v1/jp';

async function get(resource) {
  const resp = await fetch(API_ENDPOINT + resource);
  return await resp.json();
}

async function getPensionInsuranceInfo(date) {  // 厚生年金保険情報を得る
  const tables = await get('/pension/remuneration-tables.json');
  const { id } = tables.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end));
  const table = await get(`/pension/remuneration-tables/${id}.json`);
  const division = await get('/pension/types/general.json');
  const revision = division.revisions.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end));
  return { table, revision };
}

async function getHealthInsuranceInfo(date) {  // 健康保険情報を得る
  const tables = await get('/health-insurance/remuneration-tables.json');
  const { id } = tables.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end));
  const table = await get(`/health-insurance/remuneration-tables/${id}.json`);
  const division = await get('/health-insurance/organizations/kyoukaikenpo-tokyo.json');  // 協会けんぽ東京都
  const revision = division.revisions.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end));
  return { table, revision };
}

async function getEmploymentInsuranceInfo(date, { type = 'general' } = {}) {  // 雇用保険情報を得る
  const division = await get(`/employment-insurance/types/${type}.json`);
  const revision = division.revisions.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end));
  return { revision };
}

function roundHalfDown(value) {  // 社会保険料の被保険者負担分（従業員分）は五捨五超入
  const down = Math.floor(value);
  return value - down <= 0.5 ? down : Math.ceil(value);
}

async function getWithholdingTax(date, taxableIncome, { nDependents } = {}) {
  const tables = await get(`/withholding-tax/monthly-tables.json`);
  const { id } = tables.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end));
  const table = await get(`/withholding-tax/monthly-tables/${id}.json`);
  const row = table.find(({ start, end }) =>
    start <= taxableIncome && (taxableIncome < end || !end));
  const tax = nDependents === undefined || nDependents === null ?
    row.unknown :
    [
      row.dependents0,
      row.dependents1,
      row.dependents2,
      row.dependents3,
      row.dependents4,
      row.dependents5,
      row.dependents6,
      row.dependents7,
    ][nDependents];
  return tax;
}

// 基本情報を設定
const monthlyIncome = 300_000;  // 月収
const nDependents = 2;  // 扶養親族等の数: 0..7
// const nDependents = null;  // 不明な場合
const date = new Date();

// 厚生年金保険料を取得
const pensionInsuranceInfo = await getPensionInsuranceInfo(date);
const pensionGrade = pensionInsuranceInfo.table.find(({ start, end }) => start <= monthlyIncome && (monthlyIncome < end || !end));
const pensionInsurancePremium = pensionGrade.remuneration * pensionInsuranceInfo.revision.rate;
const employeePensionInsurancePremium = roundHalfDown(pensionInsurancePremium * pensionInsuranceInfo.revision.contributionRate);
const employerPensionInsurancePremium = pensionInsurancePremium - employeePensionInsurancePremium;

// 健康保険料を取得
const healthInsuranceInfo = await getHealthInsuranceInfo(date);
const healthGrade = healthInsuranceInfo.table.find(({ start, end }) => start <= monthlyIncome && (monthlyIncome < end || !end));
const healthInsurancePremium = healthGrade.remuneration * healthInsuranceInfo.revision.rate;
const employeeHealthInsurancePremium = roundHalfDown(healthInsurancePremium * healthInsuranceInfo.revision.contributionRate);
const employerHealthInsurancePremium = healthInsurancePremium - employeeHealthInsurancePremium;

// 雇用保険料を取得
const employmentInsuranceInfo = await getEmploymentInsuranceInfo(date);
const employeeEmploymentInsurancePremium = roundHalfDown(monthlyIncome * employmentInsuranceInfo.revision.employeeRate);
const employerEmploymentInsurancePremium = roundHalfDown(monthlyIncome * employmentInsuranceInfo.revision.employerRate);

// 課税所得を算出
const taxableIncome =
  monthlyIncome -
  employeePensionInsurancePremium -
  employeeHealthInsurancePremium -
  employeeEmploymentInsurancePremium;

// 源泉徴収税（所得税）を取得
const incomeTax = await getWithholdingTax(date, taxableIncome, { nDependents });

// 振込支給額を算出
const payment =
  monthlyIncome -
  employeePensionInsurancePremium -
  employeeHealthInsurancePremium -
  employeeEmploymentInsurancePremium -
  incomeTax;

// 給与明細の形式で出力
console.log(
  JSON.stringify(
    Object.entries({
      monthlyIncome,                       // 基本給
      employeePensionInsurancePremium,     // 厚生年金保険料（被保険者負担分）
      employerPensionInsurancePremium,     // 厚生年金保険料（事業主負担分）
      employeeHealthInsurancePremium,      // 健康保険料（被保険者負担分）
      employerHealthInsurancePremium,      // 健康保険料（事業主負担分）
      employeeEmploymentInsurancePremium,  // 雇用保険料（被保険者負担分）
      employerEmploymentInsurancePremium,  // 雇用保険料（事業主負担分）
      incomeTax,                           // 源泉徴収税（所得税）
      payment                              // 振込支給額
    }).reduce((acc, [key, value]) => ({ ...acc, [key]: '¥' + value.toLocaleString() }), {}),
    null, 2)
);
```
