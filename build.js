const YAML = require('yaml');
const fs = require('node:fs').promises;
const path = require('node:path');
const { glob, globSync } = require('glob');

const SRC_DIR = 'public';
const DIST_DIR = 'dist';

const pensionRemunerationTableDir = SRC_DIR + '/*/jp/pension/standard-monthly-remuneration-tables';
const pensionDivisionDir = SRC_DIR + '/*/jp/pension/types';

const healthInsuranceRemunerationTableDir = SRC_DIR + '/*/jp/health-insurance/standard-monthly-remuneration-tables';
const healthInsuranceDivisionDir = SRC_DIR + '/*/jp/health-insurance/organizations';

const employmentInsuranceDivisionDir = SRC_DIR + '/*/jp/employment-insurance/types';

const withholdingTaxBonusTableDir = SRC_DIR + '/*/jp/withholding-tax/bonus-tables';
const withholdingTaxMonthlyTableDir = SRC_DIR + '/*/jp/withholding-tax/monthly-tables';

function createUpdateContentFunction({ startProp, endProp, getTables } = {}) {
  if (!startProp) startProp = 'start';
  if (!endProp) endProp = 'end';

  return function(content) {
    for (const table of getTables ? getTables(content) : [content]) {
      let prevRow = null;
      for (const row of table) {
        if (row[endProp] === undefined) row[endProp] = null;
        if (prevRow && prevRow[endProp] === null) prevRow[endProp] = row[startProp];
        prevRow = row;
      }
    }
  }
}

const updateDivision = createUpdateContentFunction({
  getTables: content => [content.revisions]
});

function createUpdateRemunerationTable({ getTables } = {}) {
  return createUpdateContentFunction({
    startProp: 'lowerLimit',
    endProp: 'upperLimit',
    getTables
  });
}

const updateRemunerationTable = createUpdateRemunerationTable();

const updateContentFunctions = [
  {
    prefix: pensionDivisionDir,
    update: updateDivision
  },
  {
    prefix: healthInsuranceDivisionDir,
    update: updateDivision
  },
  {
    prefix: pensionRemunerationTableDir,
    update: updateRemunerationTable
  },
  {
    prefix: healthInsuranceRemunerationTableDir,
    update: updateRemunerationTable
  },
  {
    prefix: withholdingTaxBonusTableDir,
    update: createUpdateRemunerationTable({
      getTables: content => Object.values(content)
    })
  },
  {
    prefix: withholdingTaxMonthlyTableDir,
    update: createUpdateRemunerationTable({
      getTables: content => [content.general, content.default]
    })
  }
];

function toPosixPath(location) {
  return location.split(path.sep).join('/');
}

const expandedUpdateContentFunctions = updateContentFunctions.map(x => ({
  ...x,
  prefixes: globSync(x.prefix).map(toPosixPath)
}));

function addTimezone(obj, tz = '+09:00') {
  const suffix = 'T00:00:00.000' + tz;
  
  if (typeof obj === 'string' && obj.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return obj + suffix;
  }

  if (Array.isArray(obj)) {
    // 配列の場合、各要素に対して再帰的に処理
    return obj.map(item => addTimezone(item, tz));
  } else if (typeof obj === 'object' && obj !== null) {
    // オブジェクトの場合、各プロパティに対して再帰的に処理
    return Object
      .fromEntries(Object.entries(obj).map(([k, v]) => [k, addTimezone(v)]));
  }

  return obj;  // それ以外の場合、そのまま返す
}

async function writeJSONFromYAML() {
  const targets = [SRC_DIR + '/**/*.yaml', SRC_DIR + '/**/*.yml'];
  const files = (await glob(targets)).sort();

  for (const file of files) {
    const relative = path.relative(SRC_DIR, file);
    const dist = DIST_DIR + '/' + relative;
    await fs.mkdir(path.dirname(dist), { recursive: true });

    if (['.yaml', '.yml'].includes(path.extname(file))) {
      const yaml = await fs.readFile(file, 'utf8');
      const obj = addTimezone(YAML.parse(yaml));

      const posixFile = toPosixPath(file);
      const func = expandedUpdateContentFunctions
        .find(({ prefixes }) => prefixes.find(x => posixFile.startsWith(x)));
      func?.update(obj);

      const jsonFile = path.format({
        ...path.parse(dist),
        base: undefined,
        ext: '.json'
      });
      const json = JSON.stringify(obj);
      await fs.writeFile(jsonFile, json);
    } else {
      await fs.writeFile(dist, await fs.readFile(file));
    }
  }
}

async function writeTableIndex(srcRemunerationTableDir) {
  for (const dir of await glob(srcRemunerationTableDir)) {
    const posixDir = toPosixPath(dir);
    const targets = [posixDir + '/**/*.yaml', posixDir + '/**/*.yml'];
    const files = (await glob(targets)).sort();
    const tables = [];

    for (const file of files) {
      const { name: id } = path.parse(file);
      const start = addTimezone(id);
      const last = tables[tables.length - 1];
      if (last) last.end = start;
      tables.push({ id, start, end: null });
    }

    const relative = path.relative(SRC_DIR, dir);
    const dist = DIST_DIR + '/' + relative + '.json';
    await fs.mkdir(path.dirname(dist), { recursive: true });
    await fs.writeFile(dist, JSON.stringify(tables));
  }
}

async function main() {
  writeJSONFromYAML();
  writeTableIndex(pensionRemunerationTableDir);
  writeTableIndex(healthInsuranceRemunerationTableDir);
  writeTableIndex(employmentInsuranceDivisionDir);
  writeTableIndex(withholdingTaxBonusTableDir);
  writeTableIndex(withholdingTaxMonthlyTableDir);
}

main();
