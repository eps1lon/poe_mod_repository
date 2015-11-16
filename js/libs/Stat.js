/* global GgpkEntry, this */

(function (__undefined) {
    /**
     * Stat extends GgpkEntry
     */
    this.Stat = GgpkEntry.extend({
        init: function (props) {
            this._super(props);
            this.values = [];
        },
        t: function (other_stats, localization) {
            if (localization === __undefined) {
                localization = Stat.localization;
            }

            var id = this.getProp("Id");
            if (localization.data[id] === __undefined) {
                console.log("no desc for ", id);
                return id;
            }
            
            
            var other_params = localization.data[id].params;
            var params = [this.values];
            
            if (other_params !== __undefined && other_params.length > 1) {
                params = $.map(other_params, function (param_id) {
                    var stat = $.grep(other_stats, function (stat) {
                        return param_id === stat.getProp("Id");
                    })[0];
                    
                    if (stat === __undefined) {
                        // TODO maybe 0 will match something? better of with +inf?
                        return [[0, 0]];
                    }

                    return [stat.values];
                });
            }
            
            return localization.t.apply(localization, [id].concat(params));
        },
        valueString: function () {
            if (+this.values[0] === +this.values[1]) {
                return this.values[0].toString();
            }
            
            return "(" + this.values.join(" to ") + ")";
        }
    });
    
    this.Stat.localization = null;
})();