/* global Class */

(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * Interface Serializeable
     */
    var Serializeable = Class.extend({
        serialize: function () {
            return {
                klass: "",
                args: [],
                constructor: null // a variable
            };
        }
    });
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    Serializeable.deserialize = function (serialized) {
        var constructor = serialized.constructor;
        var args = [null].concat(serialized.args);
        var factoryFunction = constructor.bind.apply(constructor, args);
        return new factoryFunction();
    };
    
    module.exports = Serializeable;
}).call(this);