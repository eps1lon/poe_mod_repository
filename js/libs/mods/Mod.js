/* global this, GgpkEntry, Mod, Stat, ValueRange */

(function (__undefined) {
    /**
     * extends GgpkEntry implements Localizeable
     */
    this.Mod = GgpkEntry.extend({
        init: function (props) {
            this._super(props);
        },
        isPrefix: function () {
            return this.isType("prefix");
        },
        isSuffix: function () {
            return this.isType("suffix");
        },
        isPremade: function () {
            return this.isType("premade");
        },
        isType: function (type) {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE[type.toUpperCase()];
        },
        isAffix: function () {
            return this.isPrefix() || this.isSuffix();
        },
        implicitCandidate: function () {
            return this.isPremade() || this.isType("vaal");
        },
        /**
         * @returns {Array<Stat>} all stats from this mod
         */
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
        /**
         * translates the stats
         * @returns {String}
         */
        t: function () {
            var stats = this.statsJoined();
            // TODO maybe check before localizing cause unique on long strings might
            // be inefficient. on the other hand we almost always handle < 10 mods
            return $.unique($.map(stats, function (stat) {
                if (stat.values.isZero()) {
                    return null;
                }
                return stat.t(stats, Mod.localization);
            })).join("\n");
        },
        /**
         * translates the correct group
         * @returns {String}
         */
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
        /**
         * string identifier of the generation type
         * @returns {String}
         */
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
        },
        /**
         * unique id for dom
         * @returns {String}
         */
        domId: function () {
            return Mod.domId(this.getProp("Rows"));
        }
    });
    
    this.Mod.domId = function (id) {
        return "mod_" + id;
    };
    
    this.Mod.MOD_TYPE = {
        PREFIX: 1,
        SUFFIX: 2,
        PREMADE: 3,
        NEMESIS: 4,
        VAAL: 5,
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
    this.Mod.correct_group_localization = null;
    this.Mod.all_stats = null;
    
    // table `mods`
    this.mods = null;
})();

