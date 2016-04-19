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
    var Alteration = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Alteration}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Alteration";
            
            // Applicable
            this.applicable_byte = Alteration.APPLICABLE_BYTE.clone();
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
                // TODO actually considers *_cannot_be_changed?
                // granted via scouring but is this true for ingame alts?
                new Scouring().applyTo(item);
                // no complete scour?
                if (!(new Transmute(this.available_mods).applyTo(item))) {
                    new Augment(this.available_mods).applyTo(item);
                }
                
                return true;
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
            return ByteSet.human(this.applicable_byte
                                 , "Alteration.applicable_byte");
        },
        name: function () {
            return "Orb of Alteration";
        }
    });
    
    Alteration.APPLICABLE_BYTE = Currency.APPLICABLE_BYTE.clone();
    Alteration.APPLICABLE_BYTE.add('NOT_MAGIC');
    Alteration.APPLICABLE_BYTE.reset();
    
    module.exports = Alteration;
}).call(this);