const MATH_LOGIC_OPERATORS = ["<", ">", ">=", "<="]
const EQUALITY_OPERATORS = ["==", "!="]
const LOGIC_OPERATORS = [...MATH_LOGIC_OPERATORS, ...EQUALITY_OPERATORS]

/**
 * The function `verifyFeatureRule` checks if a given feature rule expression is valid based on the
 * parsed parameters and features.
 * @param parsed - The `parsed` parameter is an object that contains information about the parsed data.
 * It likely includes properties such as `parameters` and `features`, which are arrays of objects
 * representing the parameters and features respectively.
 * @param featureRule - The `featureRule` parameter is an object that contains an `expression`
 * property.
 * @returns The function `verifyFeatureRule` returns a string if the resolved type of the variable is
 * not 'integer' or 'decimal'. Otherwise, it does not return anything (implicitly returns `undefined`).
 */
const verifyFeatureRule = async (parsed, featureRule) => {

    //const EXPRESSION_PATTERN = new RegExp('[$#](?<variable>\\w+)\\s*(?<operator>(' + LOGIC_OPERATORS.join('|') + '))', 'gm')
    const EXPRESSION_PATTERN = new RegExp ('(?<leftvalue>[$#]?\\w+)\\s*(?<operator>(?:'+LOGIC_OPERATORS.join('|')+'))\\s*(?<rightvalue>[$#]?\\w+)', 'gm')
    const matches = EXPRESSION_PATTERN.exec(featureRule.expression);

    if (!matches || !matches.groups) return;

    let { leftvalue,operator,rightvalue } = matches.groups;

    let resolvedType = 'string';

    const param = parsed.parameters.find(p => p.name == variable);

    if (typeof param !== 'undefined') {
        resolvedType = param.type;
    } else {
        const feature = parsed.features.find(f => f.name == variable);
        if (typeof feature !== 'undefined') {
            resolvedType = feature.type;
        }
    }

    if (!['integer', 'decimal'].includes(resolvedType)) {
        return `parameter '${variable}' isn't an 'integer' or 'decimal'!`;
    }
};

/* `module.exports` is a special object in Node.js that is used to define the public interface of a
module. In this case, it is exporting an object with two properties: `description` and `validator`. */
module.exports = {
    description: "",
    validator: async (parsed) => {

        return (await Promise.all(parsed.featureRules.map(fr => verifyFeatureRule(parsed, fr))))
            .filter(r => typeof r !== 'undefined')
            .reduce((p, c) => {
                //console.log("p", p)
                //console.log("c", c)
                if (!Array.isArray(c)) c = [c];
                return p.concat(c);
            }, []);
    }
}