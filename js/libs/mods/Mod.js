(function (__undefined) {
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
        valueString: function () {
            var stat_texts = this.valueAsArray("StatsTexts");
            
            var that = this;
            return $.map(stat_texts, function (_, i) {
                var stat_min = that.getProp("Stat" + (i + 1) + "Min");
                var stat_max = that.getProp("Stat" + (i + 1) + "Max");
                
                if (stat_min === stat_max) {
                    return stat_min;
                }
                return [stat_min, stat_max].join(" - ");
            }).join(" to ");
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
})();

