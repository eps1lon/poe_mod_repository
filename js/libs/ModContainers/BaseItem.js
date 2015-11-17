/* global ItemClass, ItemClassFactory, Item */

(function (__undefined) {
    this.BaseItem = ItemClass.extend({
        init: function (props) {
            // init ItemClass 
            var item_class_ident = ItemClassFactory.ident(+props.ItemClass);
            this._super(item_class_ident, 
                        ItemClassFactory.ITEMCLASSES[item_class_ident].TAGS, 
                        ItemClassFactory.ITEMCLASSES[item_class_ident].DOMAIN);
            
            // extended
            this.item_level = BaseItem.MAX_ILVL;
            this.entry = new GgpkEntry(props);
            
            this.random_name = "";
        },
        getTags: function () {
            return $.unique(this._super().concat(this.entry.valueAsArray("TagsKeys")));
        },
        base_name: function () {
            return this.entry.getProp("Name");
        },
        name: function () {
            switch (this.rarity) {
                case ItemClass.RARITY.MAGIC:
                    var name = "";
                    // prefix
                    if (this.prefixes().length) {
                        name += this.prefixes()[0].getProp("Name") + " ";
                    }
                    // + base_name
                    name += this.base_name();
                    // + suffix
                    if (this.suffixes().length) {
                        name += " " + this.suffixes()[0].getProp("Name");
                    }
                    
                    return name;
                case ItemClass.RARITY.RARE:
                    return "Random Name + " + this.base_name();
                default: 
                    return this.base_name();
            }
        },
        primary: function () {
            return +this.entry.getProp("Rows");
        },
        requirements: function () {
            return {
                level: this.entry.getProp("DropLevel")
            };
        }
    });
    
    this.BaseItem.MAX_ILVL = 100;
})();

