/* global Class */

(function (__undefined) {
    var Class = require('./Inheritance');
    var $ = require('./jquery/jquery_node');
    
    /**
     * Interface Serializeable
     */
    var Serializeable = Class.extend({
        serialize: function () {
            return {
                klass: "",
                args: [],
                constructor: Class // a Class instance
            };
        }
    });
    
    var serialized_struct = new Serializeable().serialize();
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    Serializeable.deserialize = function (serialized) {
        if (!Serializeable.checkStruct(serialized)) {
            console.error("struct doesnt match interface struct", serialized, serialized_struct);
            
            return null;
        }
        
        var constructor = serialized.constructor;
        var args = [null].concat(serialized.args);
        var factoryFunction = constructor.bind.apply(constructor, args);
        return new factoryFunction();
    };
    
    Serializeable.implementedBy = function (clazz) {
        if (!(clazz instanceof Class) || typeof clazz.serialize !== 'function') {
            return false;
        }
        
        return Serializeable.checkStruct(clazz.serialized());
    };
    
    Serializeable.checkStruct = function (serialized) {
        var implemented_by = true;
        
        // check if each property in the struct has the same type
        $.each(serialized_struct, function (key, value) {
            if (typeof serialized[key] !== typeof value) {
                implemented_by = false;
                return false; // break
            }
        });
        
        return implemented_by;
    };
    
    module.exports = Serializeable;
}).call(this);