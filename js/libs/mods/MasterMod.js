/* jshint bitwise:false */

(function (__undefined) {
    var ApplicableMod = require('./ApplicableMod');
    var GgpkEntry = require('../GgpkEntry');
    
    var ByteSet = require('../ByteSet');
    var $ = require('../jquery/jquery_node');
    
    /**
     * class MasterMod extends ApplicableMod
     * 
     * mod from a masterbench
     */
    var MasterMod = ApplicableMod.extend({
        init: function (mod_props, bench_props) {
            this._super(mod_props);

            this.bench = new GgpkEntry(bench_props);
            
            this.applicable_byte = MasterMod.APPLICABLE_BYTE.clone();
            this.resetApplicable();
        },
        /**
         * modname with basic stats
         * @returns {String}
         */
        name: function () {
            return this.getProp("Name") + 
                    "(" + this.bench.getProp("MasterNameShort") + " Level: " + this.bench.getProp("MasterLevel") + ")";
        },
        /**
         * applicable logic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (item, success) {
            var base_item_classes;            
            this._super(item, success);
            
            base_item_classes = this.bench.valueAsArray("BaseItemClassesKeys");
            if (base_item_classes.length > 0 && base_item_classes.indexOf(+item.entry.getProp("ItemClass")) === -1) {
                this.applicable_byte.enable('WRONG_ITEMCLASS');
            }
            
            // grep MasterMods and set failure if we cant multimod
            if ($.grep(item.mods, function (mod) {
                return mod instanceof MasterMod;
            }).length > 0 && item.inMods(MasterMod.METAMOD.MULTIMOD) === -1) {
                this.applicable_byte.enable('NO_MULTIMOD');
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success).anySet();
        },
        serialize: function () {
            return {
                klass: "MasterMod",
                args: [this.props, this.bench.props],
                constructor: MasterMod
            };
        },
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte
                                 , "MasterMod.applicable_byte");
        }
    });
    
    MasterMod.APPLICABLE_BYTE = ApplicableMod.APPLICABLE_BYTE.clone();
    MasterMod.APPLICABLE_BYTE.add('WRONG_ITEMCLASS');
    MasterMod.APPLICABLE_BYTE.add('NO_MULTIMOD');
    MasterMod.APPLICABLE_BYTE.reset();
    
    MasterMod.METAMOD = require('./meta_mods');
    
    // table `craftingbenchoptions`
    MasterMod.craftingbenchoptions = null;
    
    module.exports = MasterMod;
}).call(this);