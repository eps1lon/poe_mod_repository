/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
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
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte |= Augment.APPLICABLE_BYTE.NOT_MAGIC;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Augment.APPLICABLE_BYTE, 
                                 Augment.APPLICABLE_BYTE.SUCCESS, 
                                 "Augment.applicable_byte");
        },
        name: function () {
            return "Orb of Augmentation";
        }
    });
    
    Augment.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_MAGIC: 4
    };
    
    module.exports = Augment;
}).call(this);