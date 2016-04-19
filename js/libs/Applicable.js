(function (__undefined) {
    var Class = require('./Inheritance');
    var ByteSet = require('./ByteSet');
    
    /**
     * interface Applicable
     */
    var Applicable = Class.extend({
        init: function () {
            this.applicable_byte = Applicable.BYTESET.clone();
            this.resetApplicable();
        },
        applicableTo: function (mod_container) {
            
        },
        resetApplicable: function () {
            this.applicable_byte.reset();
        },
        applicableByteHuman: function () {
            
        },
        applicableCached: function () {
            
        }
    });
    
    Applicable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            if (Applicable.implementedBy(mod)) {
                mod.applicableTo(mod_container);
            }
            return mod;
        });
    };
    
    Applicable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return Applicable.implementedBy(mod) && mod.applicableTo(mod_container, success);
        });
    };
    
    // interface pattern
    Applicable.implementedBy = function (clazz) {
        return  clazz.applicableTo !== __undefined;
    };
    
    Applicable.BYTESET = new ByteSet([]);
    
    module.exports = Applicable;
}).call(this);