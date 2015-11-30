/* global Item, ModGenerator, Applicable, this, ByteSet */

(function (__undefined) {
    this.Scouring = Currency.extend({
        init: function () {
            this._super([]);
        },
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                // TODO affixes cannot be changed
                // and not necessarily change rarity

                // white item
                item.rarity = Item.RARITY.NORMAL;

                // without mods
                item.removeAllMods();

                return true;
            }
            
        },
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            switch (baseitem.rarity) {
                case Item.RARITY.NORMAL:
                    this.applicable_byte |= Scouring.APPLICABLE_BYTE.ALREADY_WHITE;
                    break;
                case Item.RARITY.UNIQUE:
                    this.applicable_byte |= Scouring.APPLICABLE_BYTE.UNIQUE;
                    break;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !!(this.applicable_byte & success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Scouring.APPLICABLE_BYTE, Scouring.APPLICABLE_BYTE.SUCCESS);
        }
    });
    
    this.Scouring.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        ALREADY_WHITE: 4,
        UNIQUE: 8
    };
})();