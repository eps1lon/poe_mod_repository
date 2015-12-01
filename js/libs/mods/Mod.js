/* global this, ItemClass, GgpkEntry */

(function (__undefined) {
    /**
     * extends GgpkEntry implements Localizeable
     */
    this.Mod = GgpkEntry.extend({
        init: function (props) {
            this._super(props);
        },
        isPrefix: function () {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE.PREFIX;
        },
        isSuffix: function () {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE.SUFFIX;
        },
        isImplicit: function () {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE.IMPLICIT;
        },
        isAffix: function () {
            return this.isPrefix() || this.isSuffix();
        },
        statsJoined: function () {
            var that = this;
            return $.map(this.valueAsArray("Stats"), function (row, i) {
                if (row.toString().toLowerCase() === 'null') {
                    // continue
                    return null;
                }
                
                var stat = new Stat(Mod.all_stats[row]);
                stat.values = new ValueRange(+that.getProp("Stat" + (i + 1) + "Min"),
                                             +that.getProp("Stat" + (i + 1) + "Max"));
                
                return stat;
            });
        },
        t: function () {
            var stats = this.statsJoined();
            // TODO maybe check before localizing cause unique on long strings might
            // be inefficient. on the other hand we almost always handle < 10 mods
            return $.unique($.map(stats, function (stat) {
                return stat.t(stats, Mod.localization);
            })).join("\n");
        },
        correctGroupTranslated: function () {
            var correct_group = this.getProp("CorrectGroup");
            var translated = Mod.correct_group_localization[correct_group];
            
            if (translated === __undefined || translated === "") {
                // DeCamelize
                return correct_group
                        // insert a space before all caps
                        .replace(/([A-Z])/g, ' $1');
            }
            
            return translated;
        },
        modType: function () {
            var that = this;
            return $.map(Mod.MOD_TYPE, function (mod_type, type_name) {
                if (mod_type === +that.getProp("GenerationType")) {
                    return type_name.toLowerCase();
                }
                
                return null;
            })[0];
        },
        name: function () {
            return this.getProp("Name");
        }
    });
    
    this.Mod.MOD_TYPE = {
        PREFIX: 1,
        SUFFIX: 2,
        UNIQUE: 3,
        NEMESIS: 4,
        IMPLICIT: 5,
        BLOODLINES: 6,
        TORMENT: 7,
        TEMPEST: 8
    };
    
    this.Mod.DOMAIN = {
        ITEM: 1,
        FLASK: 2,
        MONSTER: 3,
        STRONGBOX: 4,
        MAP: 5,
        STANCE: 9,
        MASTER: 10,
        JEWEL: 11
    };
    
    this.Mod.localization = null;
    this.Mod.correct_group_localization;
    this.Mod.all_stats = null;
    
    // table `mods`
    this.mods = null;
})();

