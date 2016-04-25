/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    
    var ByteSet = require('../ByteSet');
    /**
     * class Augment extends Currency
     * 
     * represantation of Orb of Augmentation
     */
    var Augment = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Augment}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Augment";
            
            // Applicable
            this.applicable_byte = Augment.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * adds one random property
         * 
         * @param {Item} item
         * @returns {Boolean} @link Item::addMod
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                return item.addMod(this.chooseMod(item));
            }
            
            return false;
        },
        /**
         * item needs to be magic
         * 
         * @param {Item} baseitem
         * @param {Byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte.enable('NOT_MAGIC');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        applicableByteHuman: function () {
            return this.applicable_byte.human("Augment.applicable_byte");
        },
        name: function () {
            return "Orb of Augmentation";
        }
    });
    
    Augment.APPLICABLE_BYTE = Currency.APPLICABLE_BYTE.clone();
    Augment.APPLICABLE_BYTE.add('NOT_MAGIC');
    Augment.APPLICABLE_BYTE.reset();
    
    module.exports = Augment;
}).call(this);