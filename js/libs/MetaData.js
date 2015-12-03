/* global Class, this */

(function (__undefined) {
    /**
     * class Metadata
     * 
     * representation of a .ot file in METADATA 
     */
    this.MetaData = Class.extend({
        init: function (clazz, props) {
            this.clazz = clazz;
            this.props = props;
        },
        isA: function (clazz) {
            return clazz === this.clazz 
                    || this.props['inheritance'].indexOf(clazz) !== -1;
        },
        valueOf: function (fascade, key, expect) {
            if (this.props[fascade] && this.props[fascade][key]) {
                switch (expect) {
                    case MetaData.EXPECT.STRING:
                        return this.props[fascade][key][0];
                    case MetaData.EXPECT.NUMBER:
                        return +this.props[fascade][key][0];
                    case MetaData.EXPECT.ARRAY:
                        return this.props[fascade][key];
                    default:
                        console.log("IllegalArgument for valueOf(fascade, key, expect)", fascade, key, expect);
                        return null;
                }
            }
            return __undefined;
        }
    });
    
    this.MetaData.build = function (clazz, meta_datas) {
        var meta_data = meta_datas[clazz];
        if (meta_data === __undefined) {
            return null;
        }
        
        return new MetaData(clazz, meta_data);
    };
    
    this.MetaData.EXPECT = {
        NUMBER: 1,
        STRING: 2,
        ARRAY: 3
    };
})();