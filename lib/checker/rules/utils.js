/**
 * The function `resolveType` determines the type of a given value based on the provided parsed data.
 * @param value - The `value` parameter is the value that needs to be resolved to its type.
 * @param parsed - The `parsed` parameter is an object that contains information about the parsed code.
 * It has two properties:
 * @returns The function `resolveType` returns the resolved type of the given value.
 */
const resolveType = (value, parsed) =>{

    if (isNaN(value)) {
        if (['true','false'].includes(value)) {
            resolvedType = 'boolean';
        } else {         
            resolvedType = 'string';
        }
    }else{
        resolvedType = 'number';
    }

    
    const param = parsed.parameters.find(p => p.name == value);

    if (typeof param !== 'undefined') {
        resolvedType = param.type;
    } else {
        const feature = parsed.features.find(f => f.name == value);
        if (typeof feature !== 'undefined') {
            resolvedType = feature.type;
        }
    }

    if (['integer', 'decimal'].includes(resolvedType)) {

        resolvedType = 'number';

    }
    return resolvedType;
};

module.exports = {
    resolveType,
};