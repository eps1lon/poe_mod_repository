(function (__undefined) {
    var Class = require('../Inheritance');
    var Serializeable = require('../Serializeable');
    
    var ModFactory = Class.extend({});
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    ModFactory.deserialize = Serializeable.deserialize;
    
    module.exports = ModFactory;
}).call(this);