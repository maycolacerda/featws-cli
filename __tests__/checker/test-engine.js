const fs = require("fs");
const path = require("path");
const { checker } = require('../../lib/checker');

const cases_dir = path.join(__dirname, "cases");

const isRulesheetFolder = (dir) => fs.existsSync(path.join(dir, "rules.featws")) || fs.existsSync(path.join(dir, "rules.json"));

function scanDir(baseDir, baseName) {
    const cases = fs.readdirSync(path.join(baseDir), "utf8");

    cases.filter(entry => fs.lstatSync(path.join(baseDir, entry)).isDirectory()).map(dir => {
        const name = [baseName, dir].join(" / ");

        if (isRulesheetFolder(path.join(baseDir, dir))) {
            if (!fs.existsSync(path.join(baseDir, dir, "expected.error"))) {
                test(name, async () => {
                    const errFile = path.join(baseDir, dir, "expected-checker.error");
                    if (fs.existsSync(errFile)) {
                        const expected = fs.readFileSync(errFile).toString();
                        return expect(checker(path.join(baseDir, dir))).resolves.toContain(expected);
                    } else {
                        return expect(checker(path.join(baseDir, dir))).resolves.toHaveLength(0);
                    }
                });
            }
        } else {
            scanDir(path.join(baseDir, dir), name);
        }
    });
}

scanDir(cases_dir, "Checker");

scanDir(cases_dir + "../../../transpiler/cases", "Transpiler");