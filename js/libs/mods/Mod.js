/* global this */

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
                stat.values = [
                    +that.getProp("Stat" + (i + 1) + "Min"),
                    +that.getProp("Stat" + (i + 1) + "Max")
                ];
                
                return stat;
            });
        },
        t: function () {
            var stats = this.statsJoined();
            return $.map(stats, function (stat) {
                return stat.t(stats, Mod.localization);
            }).join("\n");
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
    this.Mod.all_stats = null;
})();

