import json
from datetime import datetime
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from pathlib import Path
from urllib.request import urlopen

TABLES_URL = 'https://opendata.renjaku.co.jp/v1/jp/health-insurance/remuneration-tables.json'
TABLE_URL = 'https://opendata.renjaku.co.jp/v1/jp/health-insurance/remuneration-tables/{start}.json'
RATES_URL = 'https://opendata.renjaku.co.jp/v1/jp/health-insurance/organizations/kyoukaikenpo-tokyo.json'

DATE = datetime.fromisoformat('2025-03-01T00:00:00+09:00')

table_info = None
with urlopen(TABLES_URL) as resp:
    data = json.loads(resp.read())
    for item in data:
        item['start'] = datetime.fromisoformat(item['start'])
        if item['end'] is not None:
            item['end'] = datetime.fromisoformat(item['end'])
            if item['start'] <= DATE < item['end']:
                table_info = item
        elif item['start'] <= DATE:
            table_info = item
        if table_info:
            break

table_url = TABLE_URL.format(start=table_info['start'].strftime('%Y-%m-%d'))

with urlopen(table_url) as resp:
    table = json.loads(resp.read())

rate_rev = None
with urlopen(RATES_URL) as resp:
    data = json.loads(resp.read())
    for item in data['revisions']:
        item['rate'] = Decimal(str(item['rate']))
        item['careRate'] = Decimal(str(item['careRate']))
        item['contributionRate'] = Decimal(str(item['contributionRate']))
        item['start'] = datetime.fromisoformat(item['start'])
        if item['end'] is not None:
            item['end'] = datetime.fromisoformat(item['end'])
            if item['start'] <= DATE < item['end']:
                rate_rev = item
        elif item['start'] <= DATE:
            rate_rev = item
        if rate_rev:
            break


def round_half_down(value):
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    down = value.quantize(Decimal('0'), rounding=ROUND_FLOOR)
    if value - down <= Decimal('0.5'):
        return down
    return value.quantize(Decimal('0'), rounding=ROUND_CEILING)


output_file = (Path(__file__).parent / rate_rev['start'].strftime('%Y-%m-%d')).with_suffix('.csv')

with output_file.open('w', encoding='utf8') as f:
    print(','.join(map(str, [
        '標準報酬_等級',
        '標準報酬_月額',
        '報酬月額_以上',
        '報酬月額_未満',
        '介護保険の被保険者でない場合_全額',
        '介護保険の被保険者でない場合_折半額',
        '介護保険の被保険者でない場合_控除額',
        '介護保険の被保険者の場合_全額',
        '介護保険の被保険者の場合_折半額',
        '介護保険の被保険者の場合_控除額'
    ])), file=f)
    for grade_info in table:
        premium = (grade_info['remuneration'] * rate_rev['rate']).normalize()
        half_premium = (premium * rate_rev['contributionRate']).normalize()
        employee_premium = round_half_down(half_premium)

        care_premium = (grade_info['remuneration'] * rate_rev['careRate']).normalize()
        half_care_premium = (care_premium * rate_rev['contributionRate']).normalize()
        employee_care_premium = round_half_down(half_care_premium)

        all_premium = premium + care_premium
        half_all_premium = half_premium + half_care_premium
        all_employee_premium = round_half_down(half_all_premium)

        print(','.join(map(lambda x: '' if x is None else str(x), [
            grade_info['grade'],
            grade_info['remuneration'],
            grade_info['start'],
            grade_info['end'],
            premium,
            half_premium,
            employee_premium,
            all_premium,
            half_all_premium,
            all_employee_premium
        ])), file=f)
