/* global ApplicableMod, Applicable, this, ByteSet, ModContainer */

(function (__undefined) {
    this.MasterMod = ApplicableMod.extend({
        init: function (mod_props, bench_props) {
            this._super(mod_props);

            this.bench = new GgpkEntry(bench_props);
        },
        name: function () {
            return this.getProp("Name") + 
                    "(" + this.bench.getProp("MasterNameShort") + " Level: " + this.bench.getProp("MasterLevel") + ")";
        },
        applicableTo: function (item, success) {
            var base_item_classes;
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            this._super(item, success);
            
            base_item_classes = this.bench.valueAsArray("BaseItemClassesKeys");
            if (base_item_classes.length > 0 && base_item_classes.indexOf(+item.entry.getProp("ItemClass")) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.WRONG_ITEMCLASS;
            }
            
            // grep MasterMods and set failure if we cant multimod
            if ($.grep(item.mods, function (mod) {
                return mod instanceof MasterMod;
            }).length > 0 && item.inMods(MasterMod.METAMOD.MULTIMOD) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.NO_MULTIMOD;
            }
            
            // remove SUCCESS Bit from super if additional failure bits set
            if ((this.applicable_byte & Applicable.SUCCESS) &&  this.applicable_byte > Applicable.SUCCESS) {
                this.applicable_byte ^= Applicable.SUCCESS;
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        serialize: function () {
            return {
                klass: "MasterMod",
                args: [this.props, this.bench.props]
            };
        },
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, MasterMod.APPLICABLE_BYTE, MasterMod.APPLICABLE_BYTE.SUCCESS, "MasterMod.applicable_byte");
        }
    });
    
    this.MasterMod.APPLICABLE_BYTE = {
        // ApplicableMod
        UNSCANNED: 0, // per convention 
        SUCCESS: 1, 
        DOMAIN_FULL: 2,
        ALREADY_PRESENT: 4,
        WRONG_DOMAIN: 8,
        LOWER_ILVL: 16,
        // MasterMod
        WRONG_ITEMCLASS: 32,
        NO_MULTIMOD: 64
    };
    
    this.MasterMod.METAMOD = {
        LOCKED_PREFIXES: 4341,
        LOCKED_SUFFIXES: 4342,
        NO_ATTACK_MODS: 4343,
        NO_CASTER_MODS: 4344,
        MULTIMOD: 4345,
        LLD_MODS: 4288
    };
    
    // table `craftingbenchoptions`
    this.MasterMod.craftingbenchoptions = null;
})();