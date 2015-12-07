/* jshint bitwise:false */

/* global Currency, Alteration, Transmute, Item, Applicable, this, ByteSet */

(function (__undefined) {
    /**
     * class Augment extends Currency
     * 
     * represantation of Orb of Augmentation
     */
    this.Alteration = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Alteration}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Alteration";
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
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte |= Alteration.APPLICABLE_BYTE.NOT_MAGIC;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Alteration.APPLICABLE_BYTE, Alteration.APPLICABLE_BYTE.SUCCESS);
        }
    });
    
    this.Alteration.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_MAGIC: 4
    };
})();