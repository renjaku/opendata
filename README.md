# Renjaku/Open Data

日本の社会保険・雇用保険・源泉徴収に関する公的な書類を構造化データに変換し、API から使いやすい形で提供するためのリポジトリです。

## 収録データ

分類 | 内容 | パス例
--- | --- | ---
年金 | 標準報酬月額表 | `public/v1/jp/pension/standard-monthly-remuneration-tables/2020-09-01.yaml`
年金 | 区分（料率） | `public/v1/jp/pension/types/general.yaml`
健康保険 | 標準報酬月額表 | `public/v1/jp/health-insurance/standard-monthly-remuneration-tables/2016-04-01.yaml`
健康保険 | 組合（例：協会けんぽ東京、ITS） | `public/v1/jp/health-insurance/organizations/kyoukaikenpo-tokyo.yaml`
雇用保険 | 区分（料率） | `public/v1/jp/employment-insurance/types/general.yaml`
源泉徴収 | 月額表 | `public/v1/jp/withholding-tax/monthly-tables/2026-01-01.yaml`
源泉徴収 | 賞与表 | `public/v1/jp/withholding-tax/bonus-tables/2020-01-01.yaml`

## API

公開 API エンドポイントは `https://opendata.renjaku.co.jp` です。

リポジトリ内のソースファイルは `npm run build` により API リソースとして公開されます。 基本的なルールとして YAML ソースは JSON ファイルに変換されます。

```sh
# 最初に標準報酬月額表の一覧を取得
curl https://opendata.renjaku.co.jp/v1/jp/pension/standard-monthly-remuneration-tables.json

# 現在日時をもとに目当ての月額表を特定
TARGET=2020-09-01

# 目当ての月額表を取得
curl https://opendata.renjaku.co.jp/v1/jp/pension/standard-monthly-remuneration-tables/$TARGET.json
```

JavaScript の場合:

```javascript
const API_ENDPOINT = 'https://opendata.renjaku.co.jp/v1/jp';

async function get(resource) {
  const resp = await fetch(API_ENDPOINT + resource);
  return await resp.json();
}

async function getPensionTable(date) {
  const tables = await get('/pension/standard-monthly-remuneration-tables.json');
  const { id } = tables.find(({ start, end }) =>
    new Date(start) <= date && (date < new Date(end) || !end)
  );
  return await get(`/pension/standard-monthly-remuneration-tables/${id}.json`);
}
```
