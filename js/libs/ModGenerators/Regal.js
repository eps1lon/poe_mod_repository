/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var ByteSet = require('../ByteSet');
    /**
     * class Regal extrends @link Currency
     * 
     * ingame representation of Regal Orb
     */
    var Regal = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Regal}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Regal";
            
            // Applicable
            this.applicable_byte = Regal.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * adds one random prop and upgrades to rare
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            if (this.applicableTo(item)) {
                // upgrade to rare
                item.rarity = Item.RARITY.RARE;

                return item.addMod(this.chooseMod(item));
            }
            return false;
        },
        /**
         * maps mod::applicableTo as if it were already rare
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * greps mod::applicableTo as if it were already rare
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        mods: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * only applicable to magics
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte.enable('NOT_MAGIC');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return this.applicable_byte.human("Regal.applicable_byte");
        },
        name: function () {
            return "Regal Orb";
        }
    });
    
    Regal.APPLICABLE_BYTE = Currency.APPLICABLE_BYTE.clone();
    Regal.APPLICABLE_BYTE.add('NOT_MAGIC');
    Regal.APPLICABLE_BYTE.reset();
    
    module.exports = Regal;
}).call(this);