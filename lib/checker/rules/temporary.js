const MATH_OPERATORS = ["<", ">", ">=", "<="];

/**
 * The function `validateFeatureRuleExpression` extracts the variable name from a given expression.
 * @param expression - The `expression` parameter is a string that represents a feature rule
 * expression.
 * @returns The function `validateFeatureRuleExpression` returns the variable name extracted from the
 * given expression.
 */
const validateFeatureRuleExpression = (expression) => {
    const EXPRESSION_PATTERN = new RegExp('[$#](?<variable>\\w+)\\s*(?<operator>(' + MATH_OPERATORS.join('|') + '))', 'gm');
    const matches = EXPRESSION_PATTERN.exec(expression);
    return matches && matches.groups ? matches.groups.variable : null;
};

/**
 * The function `getTypeFromParsed` takes in a parsed object, a variable name, and a type, and returns
 * the type of the variable if it exists in the parsed object, otherwise it returns 'string'.
 * @param parsed - The `parsed` parameter is an object that contains parsed data. It likely has a
 * structure similar to this:
 * @param variableName - The variableName parameter is a string that represents the name of the
 * variable you want to find in the parsed object.
 * @param type - The `type` parameter is a string that represents the type of the variable you are
 * looking for in the `parsed` object.
 * @returns The function `getTypeFromParsed` returns the type of the variable with the given
 * `variableName` from the `parsed` object. If the variable is found in the `parsed` object, it returns
 * the type of the variable. If the variable is not found, it returns the string `'string'`.
 */
const getTypeFromParsed = (parsed, variableName, type) => {
    const item = parsed[type].find(item => item.name === variableName);
    return item ? item.type : 'string';
};

/**
 * The function `verifyFeatureRule` validates a feature rule expression and checks if the resolved type
 * is either an 'integer' or 'decimal'.
 * @param parsed - The `parsed` parameter is an object that represents some parsed data.
 * @param featureRule - {
 * @returns The function `verifyFeatureRule` returns a string if the `resolvedType` is not one of the
 * valid types ('integer' or 'decimal'). The string returned is `"parameter '' isn't an
 * 'integer' or 'decimal'!"`.
 */
/**
 * The function `verifyFeatureRule` validates a feature rule expression and checks if the resolved type
 * is either an 'integer' or 'decimal'.
 * @param parsed - The `parsed` parameter is an object that represents some parsed data.
 * @param featureRule - {
 * @returns The function `verifyFeatureRule` returns a string if the `resolvedType` is not one of the
 * valid types ('integer' or 'decimal'). The string returned is `"parameter '' isn't an
 * 'integer' or 'decimal'!"`.
 */
const verifyFeatureRule = async (parsed, featureRule) => {
    const variable = validateFeatureRuleExpression(featureRule.expression);
    if (!variable) return;

    const resolvedType = getTypeFromParsed(parsed, variable, 'parameters') || getTypeFromParsed(parsed, variable, 'features');
    
    const validTypes = new Set(['integer', 'decimal']);
    if (!validTypes.has(resolvedType)) {
        return `parameter '${variable}' isn't an 'integer' or 'decimal'!`;
    }
};

/* `module.exports` is a special object in Node.js that is used to define the public interface of a
module. In this case, the module is exporting an object with two properties: `description` and
`validator`. */
module.exports = {
    description: "Validates feature rule expressions",
    validator: async (parsed) => {
        try {
            return (await Promise.all(parsed.featureRules.map(fr => verifyFeatureRule(parsed, fr))))
                .filter(Boolean)
                .reduce((acc, curr) => acc.concat(curr), []);
        } catch (error) {
            console.error("An error occurred:", error);
            return [];
        }
    }
};
