/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var ByteSet = require('../concerns/ByteSet');
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
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.RARE) {
                this.applicable_byte |= Exalted.APPLICABLE_BYTE.NOT_RARE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Exalted.APPLICABLE_BYTE, 
                                 Exalted.APPLICABLE_BYTE.SUCCESS, 
                                 "Exalted.applicable_byte");
        },
        name: function () {
            return "Exalted Orb";
        }
    });
    
    Exalted.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_RARE: 4
    };
    
    module.exports = Exalted;
}).call(this);