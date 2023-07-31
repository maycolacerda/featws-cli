const { parser } = require("../parser");
const rules = require("./rules");

const checker = async (dir) => {
  try {
    const data = await parser(dir);
    return (await Promise.all(Object.entries(rules).map(async ([ruleName, rule]) =>
      (
        await rule.validator(data))
        .map(e => `${ruleName}: ${e}`)
    )))
      .filter(r => typeof r !== 'undefined')
      .reduce((p, c) => {
        if (!Array.isArray(c)) c = [c];
        return p.concat(c);
      }, [])

  } catch (e) {
    console.error(e)
    throw e;
  }
};

const check = async (dir) => {
  try {
    const errors = await checker(dir);
    if (errors.length > 0) {
      errors.forEach(e => console.error(e));
      process.exit(1);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = {
  checker,
  check,
};