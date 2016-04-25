/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var ByteSet = require('../ByteSet');
    
    /**
     * class Exalted extends Currency
     * 
     * ingame representation of Exalted orb
     */
    var Exalted = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Exalted}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Exalted";
            
            // Applicable
            this.applicable_byte = Exalted.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * adds one random property to an item
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                return item.addMod(this.chooseMod(item));
            }
            return false;
        },
        /**
         * only applicable to rare items
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            
            if (baseitem.rarity !== Item.RARITY.RARE) {
                this.applicable_byte.enable('NOT_RARE');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return this.applicable_byte.human("Exalted.applicable_byte");
        },
        name: function () {
            return "Exalted Orb";
        }
    });
    
    Exalted.APPLICABLE_BYTE = Currency.APPLICABLE_BYTE.clone();
    Exalted.APPLICABLE_BYTE.add('NOT_RARE');
    Exalted.APPLICABLE_BYTE.reset();
    
    module.exports = Exalted;
}).call(this);