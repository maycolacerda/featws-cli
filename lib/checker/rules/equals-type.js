const { resolveType } = require('./utils.js');

/**
 * The above JavaScript code defines a function called `verifyFeatureRule` that validates a feature
 * rule expression and returns any errors encountered.
 * @param parsed - The `parsed` parameter is an object that contains the parsed data. It likely
 * includes properties such as `parameters`, `features`, and `featureRules`, which are used in the
 * `verifyFeatureRule` function.
 * @param featureRule - The `featureRule` parameter is an object that represents a rule for a specific
 * feature. It contains the following properties:
 * @returns The `verifyFeatureRule` function returns a string if certain conditions are met. If none of
 * the conditions are met, or if there are no matches or groups in the regular expression, the function
 * does not return anything.
 */

const verifyFeatureRule = async (parsed, featureRule) => {

    const EXPRESSION_PATTERN = new RegExp ('^(?<lefttype>[$#]?)(?<leftvalue>(?:\\w+)|(?:\'[^\']+\')|(?:"[^"]+"))\\s*(?<operator>(?:==|!=))\\s*(?<righttype>[$#]?)(?<rightvalue>(?:\\w+)|(?:\'[^\']+\')|(?:"[^"]+"))$', 'gm')
    const matches = EXPRESSION_PATTERN.exec(featureRule.expression);

    if (!matches || !matches.groups) return;

    let { lefttype,leftvalue,operator,righttype,rightvalue } = matches.groups;

    let resolvedTypeLeft = resolveType(leftvalue, parsed);
    let resolvedTypeRight = resolveType(rightvalue, parsed);
    
    
    if (resolvedTypeLeft !== resolvedTypeRight) {
        return `variables '${lefttype}${leftvalue}' and '${righttype}${rightvalue}' aren't the same type!`;
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


