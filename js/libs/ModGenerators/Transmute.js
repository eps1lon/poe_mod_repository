/* global Mod, ModGenerator, Item, Currency, ByteSet, this, Applicable */

(function (__undefined) {
    this.Transmute = Currency.extend({
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
        },
        applyTo: function (mod_container) {
            // TODO deprecated
            if (mod_container.rarity === Item.rarity.NORMAL) {
                // change to magic
                mod_container.rarity = Item.rarity.MAGIC;

                // add one affix
                if (mod_container.addMod(this.chooseApplicableMod(mod_container))) {
                    // and maybe another
                    // TODO transmute rolls for number of affixes?
                    if (Math.random() <= 0.5) {
                        mod_container.addMod(this.chooseApplicableMod(mod_container));
                    }
                    return true;
                }
                // something went wrong revert to old rarity
                mod_container.rarity = Item.rarity.NORMAL;
                
                throw new ModGeneratorException("no applicable mods found");
                
                return false;
            }
            
            // TODO transmute ingame msg when not white
            throw new ModGeneratorException("not normal rarity");
            
            return false;
        },
        map: function (item, success) {
            if (this.applicableTo(item)) {
                // simulate upgrade
                item.rarity = Item.RARITY.MAGIC;
                var mods = this._super(item, success);
                item.rarity = Item.RARITY.NORMAL;
                
                return mods;
            }
            
            return [];
        },
        mods: function (item, success) {
            console.log(this.applicableTo(item), this.applicable_byte);
            if (this.applicableTo(item)) {
                // simulate upgrade
                item.rarity = Item.RARITY.MAGIC;
                var mods = this._super(item, success);
                item.rarity = Item.RARITY.NORMAL;
                
                return mods;
            }
            
            return [];
        },
        /**
         * 
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.NORMAL) {
                this.applicable_byte |= Transmute.APPLICABLE_BYTE.NOT_WHITE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !!(this.applicable_byte & success);
        },
        /**
         *
         * @returns {String}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Transmute.APPLICABLE_BYTE, Transmute.APPLICABLE_BYTE.SUCCESS);
        }
    });
    
    this.Transmute.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_WHITE: 4
    };
    
    this.Transmute.mod_filter = function (mod_props) {
        // prefix/suffix only
        return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX].indexOf(+mod_props["GenerationType"]) !== -1;
    };
})();