/* global ApplicableMod, Applicable, this */

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
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            this._super(item, success);
            
            if (this.bench.valueAsArray("BaseItemClassesKeys").indexOf(+item.entry.getProp("ItemClass")) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.WRONG_ITEMCLASS;
            }
            
            // remove SUCCESS Bit from super if additional failure bits set
            if ((this.applicable_byte & Applicable.SUCCESS) &&  this.applicable_byte > Applicable.SUCCESS) {
                this.applicable_byte ^= Applicable.SUCCESS;
            }
            
            // to bool
            return !!(this.applicable_byte & success);
        },
        serialize: function () {
            return {
                klass: "MasterMod",
                args: [this.props, this.bench.props]
            };
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
        WRONG_ITEMCLASS: 32 
    };
    
    // table `craftingbenchoptions`
    this.MasterMod.craftingbenchoptions = null;
})();