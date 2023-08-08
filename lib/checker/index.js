/* The code is importing the `parser` function from a module located in the parent directory
(`../parser`) and assigning it to a constant variable named `parser`. It is also importing the
`rules` object from a module located in the current directory (`./rules`) and assigning it to a
constant variable named `rules`. */
const { parser } = require("../parser");
const rules = require("./rules");

/**
 * The `checker` function takes a directory as input, parses the data in that directory, applies a set
 * of validation rules to the data, and returns an array of validation errors.
 * @param dir - The `dir` parameter is a string that represents the directory path where the data is
 * located.
 * @returns The function `checker` returns an array of strings. Each string represents a validation
 * error and follows the format "ruleName: error".
 */
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

/**
 * The function `check` is an asynchronous function that takes a directory as an argument and checks
 * for errors using the `checker` function, logging any errors to the console and exiting the process
 * if there are any.
 * @param dir - The `dir` parameter is a string that represents the directory path that needs to be
 * checked.
 */
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

/* `module.exports` is a special object in Node.js that is used to define the public interface of a
module. In this case, `module.exports` is being used to export two functions, `checker` and `check`,
so that they can be used in other modules. */
module.exports = {
  checker,
  check,
};