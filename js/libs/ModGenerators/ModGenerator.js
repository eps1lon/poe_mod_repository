(function (__undefined) {
    var Class = require('../Inheritance');
    var Applicable = require('../Applicable');
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /*
     * abstract Class ModGenerator implements Applicable
     */
    var ModGenerator = Class.extend({
        /**
         * 
         * @param {Array[mods]} mod_collection
         * @param {? extends Mod} mod_klass
         * @param {Function} filter filter for mod_props
         * @returns {ModGenerator}
         */
        init: function (mod_collection, mod_klass, filter) {
            this.uses = Number.POSITIVE_INFINITY;
            
            if (filter === __undefined) {
                // dummy filter
                filter = function () { return true; };
            }
            
            this.available_mods = $.map(mod_collection, function (mod) {
                if (!(mod instanceof mod_klass)) {
                    mod = new mod_klass(mod);
                }
                
                if (filter(mod.props)) {
                    return mod;
                }
                return null;
            });
            
            // Applicable
            this.applicable_byte = Applicable.BYTESET.clone();
            this.resetApplicable();
        },
        /**
         * abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            
        },
        /**
         * 
         * @returns {Array[Mod]}
         */
        getAvailableMods: function () {
            return this.available_mods.slice();
        },
        mods: function (mod_container, success) {
            return this.getAvailableMods();
        },
        map: function (mod_container, success) {
            return this.getAvailableMods();
        },
        /**
         * abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applicableTo: function (mod_container) {
            return false;
        },
        resetApplicable: function () {
            this.applicable_byte.reset();
        },
        /**
         * abstract
         * @returns {String}
         */
        applicableByteHuman: function () {
            return 'abstract';
        },
        applicableCached: function () {
            return this.applicable_byte;
        },
        chooseMod: function (baseitem) {
            
            var mods = this.mods(baseitem);
           
            // TODO spawnweight
            return mods[Math.floor(Math.random() * (mods.length - 1))];
        },
        name: function () {
            return "AbstractModGenerator";
        }
    }); 
    
    module.exports = ModGenerator;
}).call(this);

