/* jshint bitwise: false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    var Mod = require('../mods/Mod');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    
    /**
     * class Transmute extends Currency
     * 
     * ingame representation of Orb of Transmutation
     */
    var Transmute = Currency.extend({
        /**
         * @constructor
         * @param {type} all_mods
         * @returns {Transmute}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Transmute";
        },
        /**
         * adds 1-2 mods
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            if (this.applicableTo(item)) {
                // upgrade to rare
                item.rarity = Item.RARITY.MAGIC;

                item.addMod(this.chooseMod(item));
                if (Math.random() <= 0.5) {
                    item.addMod(this.chooseMod(item));
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * maps mod::applicableTo as if it were already magic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.MAGIC;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * greps mod::applicableTo as if it were already magic
         * @param {type} item
         * @param {type} success
         * @returns {Array}
         */
        mods: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.MAGIC;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
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
            
            if (baseitem.rarity !== Item.RARITY.NORMAL) {
                this.applicable_byte |= Transmute.APPLICABLE_BYTE.NOT_WHITE;
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
                                 Transmute.APPLICABLE_BYTE, 
                                 Transmute.APPLICABLE_BYTE.SUCCESS, 
                                 "Transmute.applicable_byte");
        },
        name: function () {
            return "Orb of Transmutation";
        }
    });
    
    Transmute.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        CORRUPTED: 4,
        MIRRORED: 8,
        // extended
        NOT_WHITE: 16
    };
    
    Transmute.mod_filter = function (mod_props) {
        // prefix/suffix only
        return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Transmute;
}).call(this);